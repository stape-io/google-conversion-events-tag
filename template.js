const BigQuery = require('BigQuery');
const computeEffectiveTldPlusOne = require('computeEffectiveTldPlusOne');
const createRegex = require('createRegex');
const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getContainerVersion = require('getContainerVersion');
const getCookieValues = require('getCookieValues');
const getEventData = require('getEventData');
const getGoogleAuth = require('getGoogleAuth');
const getRequestHeader = require('getRequestHeader');
const getTimestampMillis = require('getTimestampMillis');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeInteger = require('makeInteger');
const makeNumber = require('makeNumber');
const makeString = require('makeString');
const Math = require('Math');
const parseUrl = require('parseUrl');
const Object = require('Object');
const sendHttpRequest = require('sendHttpRequest');
const setCookie = require('setCookie');
const sha256Sync = require('sha256Sync');
const toBase64 = require('toBase64');

/*==============================================================================
==============================================================================*/

const apiVersion = '1';
const eventData = getAllEventData();
const useOptimisticScenario = isUIFieldTrue(data.useOptimisticScenario);

if (shouldExitEarly(data, eventData)) {
  return data.gtmOnSuccess();
}

const actionHandlers = {
  pageview: handlePageViewEvent,
  conversion: handleConversionEvent
};

const handler = actionHandlers[data.eventType || 'conversion'];
if (handler) {
  const error = handler(data, eventData);
  if (error) return;
} else {
  return data.gtmOnFailure();
}

if (useOptimisticScenario) {
  return data.gtmOnSuccess();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function createSessionAttributesBase64String(sessionAttributes) {
  let sessionAttributesBase64 = toBase64(JSON.stringify(sessionAttributes));

  // Attempt to reduce the payload size if it exceeds the 4000-character limit.
  const keysToRemove = ['landing_page_referrer', 'landing_page_user_agent'];
  for (const key of keysToRemove) {
    if (sessionAttributesBase64.length <= 4000) break;
    sessionAttributes[key] = undefined;
    sessionAttributesBase64 = toBase64(JSON.stringify(sessionAttributes));
  }
  if (sessionAttributesBase64.length > 4000) return;

  const plusSignRegex = createRegex('\\+', 'g');
  const forwardSlashRegex = createRegex('\\/', 'g');
  const equalSignSuffixRegex = createRegex('=+$', 'g');
  return sessionAttributesBase64
    .replace(plusSignRegex, '-')
    .replace(forwardSlashRegex, '_')
    .replace(equalSignSuffixRegex, '');
}

function handlePageViewEvent(data, eventData) {
  const url = getUrl(eventData);
  if (!url) {
    data.gtmOnSuccess();
    return;
  }

  // Ref: https://support.google.com/google-ads/answer/16194756

  const urlSearchParams = parseUrl(url).searchParams;
  const urlSearchParamsKeys = Object.keys(urlSearchParams);
  const hasAdsParams = urlSearchParamsKeys.some((key) => {
    return (
      (key.indexOf('gad_') === 0 || key === 'gclid' || key === 'gbraid') && urlSearchParams[key]
    );
  });

  if (!hasAdsParams) {
    data.gtmOnSuccess();
    return;
  }

  const sessionAttributes = {};
  urlSearchParamsKeys.forEach((key) => {
    if (key.indexOf('gad_') === 0) sessionAttributes[key] = urlSearchParams[key];
  });
  sessionAttributes.session_start_time_usec = makeString(getTimestampMillis() * 1000);
  if (eventData.page_location) sessionAttributes.landing_page_url = eventData.page_location;
  if (eventData.page_referrer) sessionAttributes.landing_page_referrer = eventData.page_referrer;
  if (eventData.user_agent) sessionAttributes.landing_page_user_agent = eventData.user_agent;

  let sessionAttributesBase64 = createSessionAttributesBase64String(sessionAttributes);
  if (!sessionAttributesBase64) {
    log({
      Name: 'GoogleConversionEvent',
      Type: 'Message',
      EventName: 'PageviewEvent',
      Message: 'Cookie was not set.',
      Reason: 'Session attributes base64 cookie is bigger than 4000 characters.'
    });
    data.gtmOnFailure();
    return true;
  }

  const cookieOptions = {
    domain: getCookieDomain(data),
    samesite: data.cookieSameSite || 'none',
    path: '/',
    secure: true,
    httpOnly: !!data.cookieHttpOnly,
    'max-age': 60 * 60 * 24 * (makeInteger(data.cookieExpiration) || 90)
  };
  setCookie('_dm_session_attributes', sessionAttributesBase64, cookieOptions, false);

  data.gtmOnSuccess();
  return;
}

function addDestinationsData(data, mappedData) {
  const destinations = [];
  const accountsAndDestinationsFromUI =
    data.stapeAuthDestinationsList || data.ownAuthDestinationsList; // Mutually exclusive.

  accountsAndDestinationsFromUI.forEach((row) => {
    const productDestinationId = makeString(row.productDestinationId);
    const destination = {
      reference: productDestinationId,
      productDestinationId: productDestinationId,
      operatingAccount: {
        accountType: row.product,
        accountId: makeString(row.operatingAccountId)
      }
    };

    if (data.authFlow === 'stape' && row.linkedAccountId) {
      destination.linkedAccount = {
        accountType: row.product,
        accountId: makeString(row.linkedAccountId)
      };
    }

    if (data.authFlow === 'own' && row.loginAccountId) {
      destination.loginAccount = {
        accountType: row.product,
        accountId: makeString(row.loginAccountId)
      };
    }

    destinations.push(destination);
  });

  mappedData.destinations = destinations;

  return mappedData;
}

function addConsentData(data, mappedData) {
  const consent = {};
  const consentTypes = ['adUserData', 'adPersonalization'];

  consentTypes.forEach((consentType) => {
    if (!data[consentType]) return;
    consent[consentType] = data[consentType];
    mappedData.consent = consent;
  });

  return mappedData;
}

function getEmailAddressesFromEventData(eventData) {
  const eventDataUserData = eventData.user_data || {};

  let email =
    eventDataUserData.email ||
    eventDataUserData.email_address ||
    eventDataUserData.sha256_email ||
    eventDataUserData.sha256_email_address;

  const emailType = getType(email);

  if (emailType === 'string') email = [email];
  else if (emailType === 'array') email = email.length > 0 ? email : undefined;
  else if (emailType === 'object') {
    const emailsFromObject = Object.values(email);
    if (emailsFromObject.length) email = emailsFromObject;
  }

  return email;
}

function getPhoneNumbersFromEventData(eventData) {
  const eventDataUserData = eventData.user_data || {};

  let phone =
    eventDataUserData.phone ||
    eventDataUserData.phone_number ||
    eventDataUserData.sha256_phone_number;

  const phoneType = getType(phone);

  if (phoneType === 'string') phone = [phone];
  else if (phoneType === 'array') phone = phone.length > 0 ? phone : undefined;
  else if (phoneType === 'object') {
    const phonesFromObject = Object.values(phone);
    if (phonesFromObject.length) phone = phonesFromObject;
  }

  return phone;
}

function getAddressFromEventData(eventData) {
  const eventDataUserData = eventData.user_data || {};
  let eventDataUserDataAddress = {};
  const addressType = getType(eventDataUserData.address);
  if (addressType === 'object' || addressType === 'array') {
    eventDataUserDataAddress = eventDataUserData.address[0] || eventDataUserData.address;
  }

  const firstName =
    eventDataUserDataAddress.first_name || eventDataUserDataAddress.sha256_first_name;
  const lastName = eventDataUserDataAddress.last_name || eventDataUserDataAddress.sha256_last_name;
  const postalCode = eventDataUserDataAddress.postal_code;
  const regionCode = eventDataUserDataAddress.country;

  if (firstName && lastName && postalCode && regionCode) {
    return {
      givenName: makeString(firstName),
      familyName: makeString(lastName),
      postalCode: makeString(postalCode),
      regionCode: makeString(regionCode)
    };
  }
}

function addConversionInformation(data, eventData, conversionEvent) {
  const getValueFromItems = (eventData) => {
    if (getType(eventData.items) !== 'array' || eventData.items.length === 0) return;

    let valueFromItems = 0;
    eventData.items.forEach((i) => {
      if (!isValidValue(i.price)) return;
      const itemPrice = makeNumber(i.price);
      const itemQuantity = makeInteger(i.quantity);
      valueFromItems += itemQuantity ? itemQuantity * itemPrice : itemPrice;
    });

    return valueFromItems;
  };

  if (isUIFieldTrue(data.autoMapConversionInformation)) {
    if (eventData.transaction_id) {
      conversionEvent.transactionId = makeString(eventData.transaction_id);
    }

    if (eventData.currency) conversionEvent.currency = eventData.currency;

    const conversionValue = eventData.value || getValueFromItems(eventData);
    if (isValidValue(conversionValue)) conversionEvent.conversionValue = conversionValue;
  }

  if (data.transactionId) conversionEvent.transactionId = makeString(data.transactionId);

  if (data.eventTimestamp) {
    conversionEvent.eventTimestamp = getConversionDateTime(data.eventTimestamp);
  } else conversionEvent.eventTimestamp = getConversionDateTime();

  if (data.lastUpdatedTimestamp) {
    conversionEvent.lastUpdatedTimestamp = getConversionDateTime(data.lastUpdatedTimestamp);
  }

  if (data.currency) conversionEvent.currency = data.currency;

  if (isValidValue(data.conversionValue)) {
    conversionEvent.conversionValue = makeNumber(data.conversionValue);
  }

  if (data.eventSource) conversionEvent.eventSource = data.eventSource;

  return conversionEvent;
}

function addUserData(data, eventData, conversionEvent) {
  const itemizeUserIdentifier = (input) => {
    const type = getType(input);
    if (type === 'array') return input.filter((e) => e);
    if (type === 'string' || type === 'number') return [input];
    return [];
  };
  const userDataIDsLengthLimit = 10;

  let emailAddresses;
  let phoneNumbers;
  let address;

  if (isUIFieldTrue(data.autoMapUserData)) {
    emailAddresses = getEmailAddressesFromEventData(eventData);
    phoneNumbers = getPhoneNumbersFromEventData(eventData);
    address = getAddressFromEventData(eventData);
  }

  if (data.userDataEmailAddresses) emailAddresses = data.userDataEmailAddresses;
  if (data.userDataPhoneNumbers) phoneNumbers = data.userDataPhoneNumbers;
  if (data.addUserDataAddress) {
    const addressUIFields = [
      'userDataAddressGivenName',
      'userDataAddressFamilyName',
      'userDataAddressRegion',
      'userDataAddressPostalCode'
    ];
    const inputAllAddressFieldsAreValid = addressUIFields.every((p) => isValidValue(data[p]));

    if (inputAllAddressFieldsAreValid) {
      address = {
        givenName: makeString(data.userDataAddressGivenName),
        familyName: makeString(data.userDataAddressFamilyName),
        regionCode: makeString(data.userDataAddressRegion),
        postalCode: makeString(data.userDataAddressPostalCode)
      };
    }
  }

  if (emailAddresses || phoneNumbers || address) {
    const userIdentifiers = [];

    if (emailAddresses) {
      emailAddresses = itemizeUserIdentifier(emailAddresses);
      if (emailAddresses.length) {
        emailAddresses.forEach((email) => userIdentifiers.push({ emailAddress: email }));
      }
    }

    if (phoneNumbers) {
      phoneNumbers = itemizeUserIdentifier(phoneNumbers);
      if (phoneNumbers.length) {
        phoneNumbers.forEach((phone) => userIdentifiers.push({ phoneNumber: phone }));
      }
    }

    if (address) {
      userIdentifiers.push({
        address: address
      });
    }

    if (userIdentifiers.length > 0) {
      conversionEvent.userData = {
        userIdentifiers: userIdentifiers.slice(0, userDataIDsLengthLimit)
      };
    }
  }

  return conversionEvent;
}

function addAdIdentifiers(data, eventData, conversionEvent) {
  const adIdentifiers = {};

  if (isUIFieldTrue(data.autoMapAdIdentifiersClickIds)) {
    const clickIds = getClickIds(eventData);
    if (clickIds.gclid) adIdentifiers.gclid = clickIds.gclid;
    if (clickIds.gbraid) adIdentifiers.gbraid = clickIds.gbraid;
    if (clickIds.wbraid) adIdentifiers.wbraid = clickIds.wbraid;
  }

  if (data.adIdentifiersGclid) adIdentifiers.gclid = data.adIdentifiersGclid;
  if (data.adIdentifiersGbraid) adIdentifiers.gbraid = data.adIdentifiersGbraid;
  if (data.adIdentifiersWbraid) adIdentifiers.wbraid = data.adIdentifiersWbraid;

  if (isUIFieldTrue(data.autoMapAdIdentifiersSessionAttributes)) {
    const commonCookie = eventData.common_cookie || {};
    const sessionAttributes =
      eventData.session_attributes ||
      commonCookie._dm_session_attributes ||
      getCookieValues('_dm_session_attributes')[0];
    if (sessionAttributes) adIdentifiers.sessionAttributes = sessionAttributes;
  }

  if (data.adIdentifiersLandingPageDeviceInfoUserAgent) {
    adIdentifiers.landingPageDeviceInfo = adIdentifiers.landingPageDeviceInfo || {};
    adIdentifiers.landingPageDeviceInfo.userAgent =
      data.adIdentifiersLandingPageDeviceInfoUserAgent;
  }
  if (data.adIdentifiersLandingPageDeviceInfoIpAddress) {
    adIdentifiers.landingPageDeviceInfo = adIdentifiers.landingPageDeviceInfo || {};
    adIdentifiers.landingPageDeviceInfo.ipAddress =
      data.adIdentifiersLandingPageDeviceInfoIpAddress;
  }

  if (data.adIdentifiersSessionAttributes) {
    adIdentifiers.sessionAttributes = data.adIdentifiersSessionAttributes;
  }

  if (hasProps(adIdentifiers)) conversionEvent.adIdentifiers = adIdentifiers;

  return conversionEvent;
}

function addEventDeviceInformation(data, eventData, conversionEvent) {
  const eventDeviceInfo = {};

  if (isUIFieldTrue(data.autoMapEventDeviceInfo)) {
    if (eventData.user_agent) eventDeviceInfo.userAgent = eventData.user_agent;
    if (eventData.ip_override) eventDeviceInfo.ipAddress = eventData.ip_override;
  }

  if (data.eventDeviceInfoUserAgent) eventDeviceInfo.userAgent = data.eventDeviceInfoUserAgent;
  if (data.eventDeviceInfoIpAddress) eventDeviceInfo.ipAddress = data.eventDeviceInfoIpAddress;

  if (hasProps(eventDeviceInfo)) conversionEvent.eventDeviceInfo = eventDeviceInfo;

  return conversionEvent;
}

function addUserProperties(data, conversionEvent) {
  const userProperties = {};

  if (data.userPropertiesCustomerType) {
    userProperties.customerType = data.userPropertiesCustomerType;
  }

  if (data.userPropertiesCustomerValueBucket) {
    userProperties.customerValueBucket = data.userPropertiesCustomerValueBucket;
  }

  if (hasProps(userProperties)) {
    conversionEvent.userProperties = userProperties;
  }

  return conversionEvent;
}

function addCartData(data, eventData, conversionEvent) {
  const cartData = {};

  if (isUIFieldTrue(data.autoMapCartData)) {
    if (getType(eventData.items) === 'array' && eventData.items.length > 0) {
      const itemIdKey = data.itemIdKey ? data.itemIdKey : 'item_id';
      cartData.items = eventData.items.map((i) => {
        const item = {};
        if (i[itemIdKey]) {
          const itemId = makeString(i[itemIdKey]);
          item.merchantProductId = itemId;
          item.itemId = itemId;
        }
        if (i.quantity) item.quantity = makeString(i.quantity);
        if (isValidValue(i.price)) item.unitPrice = makeNumber(i.price);
        return item;
      });
    }
  }

  if (data.cartDataMerchantId) cartData.merchantId = makeString(data.cartDataMerchantId);

  if (data.cartDataMerchantFeedLabel) {
    cartData.merchantFeedLabel = makeString(data.cartDataMerchantFeedLabel);
  }

  if (data.cartDataMerchantFeedLanguageCode) {
    cartData.merchantFeedLanguageCode = makeString(data.cartDataMerchantFeedLanguageCode);
  }

  if (isValidValue(data.cartDataTransactionDiscount)) {
    cartData.transactionDiscount = makeNumber(data.cartDataTransactionDiscount);
  }

  if (getType(data.cartDataItems) === 'array' && data.cartDataItems.length > 0) {
    cartData.items = data.cartDataItems.map((i) => {
      const item = {};
      if (i.merchantProductId) item.merchantProductId = makeString(i.merchantProductId);
      if (i.itemId) item.itemId = makeString(i.itemId);
      if (i.quantity) item.quantity = makeString(i.quantity);
      if (isValidValue(i.unitPrice)) item.unitPrice = makeNumber(i.unitPrice);
      return item;
    });
  }

  if (hasProps(cartData)) conversionEvent.cartData = cartData;

  return conversionEvent;
}

function addCustomVariables(data, conversionEvent) {
  const customVariables = [];

  if (data.customVariablesList) {
    data.customVariablesList.forEach((d) => {
      if (!isValidValue(d.value)) return;

      const customVariable = { variable: makeString(d.name), value: makeString(d.value) };

      if (d.destinationReferences) {
        const destinationReferences = (
          getType(d.destinationReferences) === 'array'
            ? d.destinationReferences
            : [d.destinationReferences]
        )
          .filter((dr) => isValidValue(dr))
          .map((dr) => makeString(dr));

        if (destinationReferences.length) {
          customVariable.destinationReferences = destinationReferences;
        }
      }

      customVariables.push(customVariable);
    });

    if (customVariables.length > 0) conversionEvent.customVariables = customVariables;
  }

  return conversionEvent;
}

function addExperimentalFields(data, conversionEvent) {
  const experimentalFields = [];

  if (data.experimentalFieldsList) {
    data.experimentalFieldsList.forEach((d) => {
      if (!isValidValue(d.value)) return;

      experimentalFields.push({ field: d.name, value: makeString(d.value) });
    });

    if (experimentalFields.length > 0) conversionEvent.experimentalFields = experimentalFields;
  }

  return conversionEvent;
}

function addConversionEventsData(data, eventData, mappedData) {
  if (data.conversionEventMode === 'single') {
    const conversionEvent = {};

    addConversionInformation(data, eventData, conversionEvent);
    addUserData(data, eventData, conversionEvent);
    addAdIdentifiers(data, eventData, conversionEvent);
    addEventDeviceInformation(data, eventData, conversionEvent);
    addUserProperties(data, conversionEvent);
    addCartData(data, eventData, conversionEvent);
    addCustomVariables(data, conversionEvent);
    addExperimentalFields(data, conversionEvent);

    mappedData.events = [conversionEvent];
  } else if (
    data.conversionEventMode === 'multiple' &&
    getType(data.conversionEvents) === 'array'
  ) {
    mappedData.events = data.conversionEvents;
  }

  return mappedData;
}

function addEncodingData(data, mappedData) {
  // Avoids overwriting the encoding information if the tag auto-hashed (HEX output) User Data.
  const encoding = mappedData.encoding || data.userDataEncoding;
  if (encoding) mappedData.encoding = encoding;

  return mappedData;
}

function addEncryptionData(data, mappedData) {
  const encryptionInfo = {
    gcpWrappedKeyInfo: {
      keyType: data.gcpWrappedKeyType,
      wipProvider: data.gcpWrappedKeyWipProvider,
      kekUri: data.gcpWrappedKeyKekUri,
      encryptedDek: data.gcpWrappedKeyEncryptedDek
    }
  };

  mappedData.encryptionInfo = encryptionInfo;

  return mappedData;
}

function normalizeEmailAddress(email) {
  if (!email) return email;

  const emailParts = email.split('@');
  if (emailParts[1] === 'gmail.com' || emailParts[1] === 'googlemail.com') {
    return emailParts[0].split('.').join('') + '@' + emailParts[1];
  }
  return emailParts.join('@');
}

function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return phoneNumber;

  phoneNumber = phoneNumber
    .split(' ')
    .join('')
    .split('-')
    .join('')
    .split('(')
    .join('')
    .split(')')
    .join('');
  if (phoneNumber[0] !== '+') phoneNumber = '+' + phoneNumber;
  return phoneNumber;
}

function hashDataIfNeeded(mappedData) {
  const conversionEvents = mappedData.events;

  if (getType(conversionEvents) !== 'array') return;

  conversionEvents.forEach((conversionEvent) => {
    if (
      getType(conversionEvent) !== 'object' ||
      getType(conversionEvent.userData) !== 'object' ||
      getType(conversionEvent.userData.userIdentifiers) !== 'array'
    ) {
      return;
    }

    conversionEvent.userData.userIdentifiers.forEach((userIdentifier) => {
      const key = Object.keys(userIdentifier)[0];

      if (key === 'emailAddress' || key === 'phoneNumber') {
        let value = userIdentifier[key];

        if (!value) return;

        if (isSHA256HexHashed(value)) {
          mappedData.encoding = 'HEX';
          return;
        } else if (isSHA256Base64Hashed(value)) {
          mappedData.encoding = 'BASE64';
          return;
        }

        if (key === 'phoneNumber') value = normalizePhoneNumber(value);
        else if (key === 'emailAddress') value = normalizeEmailAddress(value);

        userIdentifier[key] = hashData(value);
        mappedData.encoding = 'HEX';
      } else if (key === 'address') {
        if (getType(userIdentifier.address) !== 'object') return;

        const addressKeysToHash = ['givenName', 'familyName'];
        addressKeysToHash.forEach((nameKey) => {
          const value = userIdentifier.address[nameKey];
          if (!value) return;

          if (isSHA256HexHashed(value)) {
            mappedData.encoding = 'HEX';
            return;
          } else if (isSHA256Base64Hashed(value)) {
            mappedData.encoding = 'BASE64';
            return;
          }

          userIdentifier.address[nameKey] = hashData(value);
          mappedData.encoding = 'HEX';
        });
      }
    });
  });

  return mappedData;
}

function getClickIds(eventData) {
  const parseClickIdFromCookieValue = (cookieValue, cookieType) => {
    if (getType(cookieValue) !== 'string') return;
    if (cookieType === 'server') {
      const cookieValueMatch = cookieValue.match('\\.k(.+)\\$i');
      return cookieValueMatch ? cookieValueMatch[1] : undefined;
    } else if (cookieType === 'js') {
      const cookieValueSplit = cookieValue.split('.');
      return cookieValueSplit[cookieValueSplit.length - 1];
    }
  };
  const getClickIdValueFromSources = (clickIdName, eventData, urlSearchParams) => {
    const commonCookie = eventData.common_cookie || {};
    const clickIdNameMapping = {
      gclid: { server: 'FPGCLAW', js: '_gcl_aw' },
      gbraid: { server: 'FPGCLAG', js: '_gcl_ag' },
      wbraid: { server: 'FPGCLGB', js: '_gcl_gb' }
    };
    const serverCookieName = clickIdNameMapping[clickIdName].server;
    const jsCookieName = clickIdNameMapping[clickIdName].js;
    return (
      eventData[clickIdName] ||
      urlSearchParams[clickIdName] ||
      parseClickIdFromCookieValue(
        eventData[serverCookieName] ||
          commonCookie[serverCookieName] ||
          getCookieValues(serverCookieName)[0],
        'server'
      ) ||
      parseClickIdFromCookieValue(
        eventData[jsCookieName] ||
          eventData[jsCookieName.substring(1)] ||
          commonCookie[jsCookieName] ||
          getCookieValues(jsCookieName)[0],
        clickIdName === 'gbraid' ? 'server' : 'js' // '_gcl_ag' follows the Server format
      )
    );
  };
  const urlSearchParams = (parseUrl(getUrl(eventData)) || {}).searchParams || {};

  return {
    gclid: getClickIdValueFromSources('gclid', eventData, urlSearchParams),
    gbraid: getClickIdValueFromSources('gbraid', eventData, urlSearchParams),
    wbraid: getClickIdValueFromSources('wbraid', eventData, urlSearchParams)
  };
}

function generateRequestUrl(data, apiVersion) {
  if (data.authFlow === 'own') {
    return 'https://datamanager.googleapis.com/v' + apiVersion + '/events:ingest';
  }

  const containerIdentifier = getRequestHeader('x-gtm-identifier');
  const defaultDomain = getRequestHeader('x-gtm-default-domain');
  const containerApiKey = getRequestHeader('x-gtm-api-key');
  return (
    'https://' +
    enc(containerIdentifier) +
    '.' +
    enc(defaultDomain) +
    '/stape-api/' +
    enc(containerApiKey) +
    '/v2/data-manager/events/ingest'
  );
}

function generateRequestOptions(data, apiVersion) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (data.authFlow === 'own') {
    const auth = getGoogleAuth({
      scopes: ['https://www.googleapis.com/auth/datamanager']
    });
    options.authorization = auth;
    if (data.xGoogUserProject) options.headers['x-goog-user-project'] = data.xGoogUserProject;
  } else if (data.authFlow === 'stape') {
    options.headers['x-datamanager-api-version'] = apiVersion;
    options.timeout = 20000;
  }

  return options;
}

function getDataForConversionEventsUpload(data, eventData) {
  const mappedData = {
    validateOnly: isUIFieldTrue(data.validateOnly)
  };

  addDestinationsData(data, mappedData);
  addConsentData(data, mappedData);
  addConversionEventsData(data, eventData, mappedData);
  hashDataIfNeeded(mappedData); // This should come before addEncodingData().
  addEncodingData(data, mappedData);
  if (isUIFieldTrue(data.enableUserDataEncryption)) {
    addEncryptionData(data, mappedData);
  }

  return mappedData;
}

function sendRequest(data, mappedData, apiVersion) {
  const requestUrl = generateRequestUrl(data, apiVersion);
  const requestOptions = generateRequestOptions(data, apiVersion);
  const requestBody = mappedData;

  log({
    Name: 'GoogleConversionEvent',
    Type: 'Request',
    EventName: 'ConversionEvent',
    RequestMethod: 'POST',
    RequestUrl: requestUrl,
    RequestBody: requestBody
  });

  return sendHttpRequest(requestUrl, requestOptions, JSON.stringify(requestBody))
    .then((result) => {
      // .then has to be used when the Authorization header is in use
      log({
        Name: 'GoogleConversionEvent',
        Type: 'Response',
        EventName: 'ConversionEvent',
        ResponseStatusCode: result.statusCode,
        ResponseHeaders: result.headers,
        ResponseBody: result.body
      });

      if (!useOptimisticScenario) {
        if (result.statusCode >= 200 && result.statusCode < 400) {
          data.gtmOnSuccess();
        } else {
          data.gtmOnFailure();
        }
      }
    })
    .catch((result) => {
      log({
        Name: 'GoogleConversionEvent',
        Type: 'Message',
        EventName: 'ConversionEvent',
        Message: 'Request failed or timed out.',
        Reason: JSON.stringify(result)
      });

      if (!useOptimisticScenario) data.gtmOnFailure();
    });
}

function validateMappedData(mappedData) {
  const conversionEvents = mappedData.events;

  if (getType(conversionEvents) !== 'array' || conversionEvents.length === 0) {
    return 'At least 1 Conversion Event must be specified.';
  }

  const doesNotHaveUserData = conversionEvents.some((e) => {
    return (
      getType(e.userData) !== 'object' ||
      getType(e.userData.userIdentifiers) !== 'array' ||
      e.userData.userIdentifiers.length === 0 ||
      e.userData.userIdentifiers.some((i) => {
        const userIdentifierIsObject = getType(i) === 'object';
        const userIdentifierKey = userIdentifierIsObject ? Object.keys(i)[0] : undefined;
        const userIdentifierValue = userIdentifierIsObject ? Object.values(i)[0] : undefined;
        return (
          !hasProps(i) ||
          !userIdentifierValue ||
          (userIdentifierKey === 'address' &&
            (!hasProps(userIdentifierValue) || Object.values(userIdentifierValue).some((v) => !v)))
        );
      })
    );
  });

  const doesNotHaveAdIdentifiers = conversionEvents.some((e) => {
    const adIdentifierEntries =
      getType(e.adIdentifiers) === 'object' ? Object.entries(e.adIdentifiers) : undefined;
    return (
      getType(e.adIdentifiers) !== 'object' ||
      !hasProps(e.adIdentifiers) ||
      adIdentifierEntries.every((keyValue) => {
        const key = keyValue[0];
        const value = keyValue[1];
        return (
          !value ||
          (key === 'landingPageDeviceInfo' &&
            (!hasProps(value) || Object.values(value).every((v) => !v)))
        );
      })
    );
  });

  if (doesNotHaveUserData && doesNotHaveAdIdentifiers) {
    return 'At least 1 Ad Identifier or User Data must be specified.';
  }

  const destinations = mappedData.destinations;
  const validationKeys = [
    'productDestinationId',
    'reference',
    'operatingAccount.accountId',
    'linkedAccount.accountId',
    'loginAccount.accountId'
  ];
  for (let i = 0; i < destinations.length; i++) {
    const destination = destinations[i];
    for (let j = 0; j < validationKeys.length; j++) {
      const key = validationKeys[j];
      const parts = key.split('.');
      if (parts.length > 1 && !destination[parts[0]]) continue;
      const value = parts.reduce((acc, part) => acc && acc[part], destination);
      if (!isValidValue(value) || value === 'undefined') {
        return 'destinations[' + i + '].' + key + ' is invalid.';
      }
    }
  }
}

function handleConversionEvent(data, eventData) {
  const mappedData = getDataForConversionEventsUpload(data, eventData);

  const invalidOrMissingFields = validateMappedData(mappedData);
  if (invalidOrMissingFields) {
    log({
      Name: 'GoogleConversionEvent',
      Type: 'Message',
      EventName: 'ConversionEvent',
      Message: 'Request was not sent.',
      Reason: invalidOrMissingFields
    });

    data.gtmOnFailure();
    return true;
  }

  sendRequest(data, mappedData, apiVersion);
}

/*==============================================================================
  Helpers
==============================================================================*/

function shouldExitEarly(data, eventData) {
  if (!isConsentGivenOrNotRequired(data, eventData)) return true;

  const url = getUrl(data);
  if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) return true;

  return false;
}

function getUrl(eventData) {
  return eventData.page_location || eventData.page_referrer || getRequestHeader('referer');
}

function getCookieDomain(data) {
  return !data.cookieDomain || data.cookieDomain === 'auto'
    ? computeEffectiveTldPlusOne(getEventData('page_location') || getRequestHeader('referer')) ||
        'auto'
    : data.cookieDomain;
}

function enc(data) {
  return encodeUriComponent(makeString(data || ''));
}

function hasProps(obj) {
  return getType(obj) === 'object' && Object.keys(obj).length > 0;
}

function isSHA256Base64Hashed(value) {
  if (!value) return false;
  const valueStr = makeString(value);
  const base64Regex = '^[A-Za-z0-9+/]{43}=?$';
  return valueStr.match(base64Regex) !== null;
}

function isSHA256HexHashed(value) {
  if (!value) return false;
  const valueStr = makeString(value);
  const hexRegex = '^[A-Fa-f0-9]{64}$';
  return valueStr.match(hexRegex) !== null;
}

function hashData(value) {
  if (!value) return value;

  const type = getType(value);

  if (value === 'undefined' || value === 'null') return undefined;

  if (type === 'array') {
    return value.map((val) => hashData(val));
  }

  if (type === 'object') {
    return Object.keys(value).reduce((acc, val) => {
      acc[val] = hashData(value[val]);
      return acc;
    }, {});
  }

  if (isSHA256HexHashed(value) || isSHA256Base64Hashed(value)) return value;

  return sha256Sync(makeString(value).trim().toLowerCase(), {
    outputEncoding: 'hex'
  });
}

function getConversionDateTime(timestamp) {
  if (!timestamp) return convertTimestampToRFC(getTimestampMillis());

  let timestampInt = makeInteger(timestamp);
  if (timestampInt && getType(timestampInt) === 'number') {
    const timestampString = makeString(timestamp);
    // This will be false only in 2286, when timestamps in seconds starts to have 11 digits.
    timestampInt = timestampString.length === 10 ? timestamp * 1000 : timestamp;
    return convertTimestampToRFC(timestampInt);
  }

  return timestamp;
}

function convertTimestampToRFC(timestamp) {
  const secToMs = function (s) {
    return s * 1000;
  };
  const minToMs = function (m) {
    return m * secToMs(60);
  };
  const hoursToMs = function (h) {
    return h * minToMs(60);
  };
  const daysToMs = function (d) {
    return d * hoursToMs(24);
  };
  const format = function (value) {
    return value >= 10 ? value.toString() : '0' + value;
  };
  const fourYearsInMs = daysToMs(365 * 4 + 1);
  let year = 1970 + Math.floor(timestamp / fourYearsInMs) * 4;
  timestamp = timestamp % fourYearsInMs;

  while (true) {
    const isLeapYear = !(year % 4);
    const nextTimestamp = timestamp - daysToMs(isLeapYear ? 366 : 365);
    if (nextTimestamp < 0) {
      break;
    }
    timestamp = nextTimestamp;
    year = year + 1;
  }

  const daysByMonth =
    year % 4 === 0
      ? [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
      : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  let month = 0;
  for (let i = 0; i < daysByMonth.length; i++) {
    const msInThisMonth = daysToMs(daysByMonth[i]);
    if (timestamp > msInThisMonth) {
      timestamp = timestamp - msInThisMonth;
    } else {
      month = i + 1;
      break;
    }
  }
  const date = Math.ceil(timestamp / daysToMs(1));
  timestamp = timestamp - daysToMs(date - 1);
  const hours = Math.floor(timestamp / hoursToMs(1));
  timestamp = timestamp - hoursToMs(hours);
  const minutes = Math.floor(timestamp / minToMs(1));
  timestamp = timestamp - minToMs(minutes);
  const sec = Math.floor(timestamp / secToMs(1));

  return (
    year +
    '-' +
    format(month) +
    '-' +
    format(date) +
    'T' +
    format(hours) +
    ':' +
    format(minutes) +
    ':' +
    format(sec) +
    '+00:00'
  );
}

function isValidValue(value) {
  const valueType = getType(value);
  return valueType !== 'null' && valueType !== 'undefined' && value !== '';
}

function isUIFieldTrue(field) {
  return [true, 'true'].indexOf(field) !== -1;
}

function isConsentGivenOrNotRequired(data, eventData) {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}

function log(rawDataToLog) {
  const logDestinationsHandlers = {};
  if (determinateIsLoggingEnabled()) logDestinationsHandlers.console = logConsole;
  if (determinateIsLoggingEnabledForBigQuery()) logDestinationsHandlers.bigQuery = logToBigQuery;

  rawDataToLog.TraceId = getRequestHeader('trace-id');

  const keyMappings = {
    // No transformation for Console is needed.
    bigQuery: {
      Name: 'tag_name',
      Type: 'type',
      TraceId: 'trace_id',
      EventName: 'event_name',
      RequestMethod: 'request_method',
      RequestUrl: 'request_url',
      RequestBody: 'request_body',
      ResponseStatusCode: 'response_status_code',
      ResponseHeaders: 'response_headers',
      ResponseBody: 'response_body'
    }
  };

  for (const logDestination in logDestinationsHandlers) {
    const handler = logDestinationsHandlers[logDestination];
    if (!handler) continue;

    const mapping = keyMappings[logDestination];
    const dataToLog = mapping ? {} : rawDataToLog;

    if (mapping) {
      for (const key in rawDataToLog) {
        const mappedKey = mapping[key] || key;
        dataToLog[mappedKey] = rawDataToLog[key];
      }
    }

    handler(dataToLog);
  }
}

function logConsole(dataToLog) {
  logToConsole(JSON.stringify(dataToLog));
}

function logToBigQuery(dataToLog) {
  const connectionInfo = {
    projectId: data.logBigQueryProjectId,
    datasetId: data.logBigQueryDatasetId,
    tableId: data.logBigQueryTableId
  };

  dataToLog.timestamp = getTimestampMillis();

  ['request_body', 'response_headers', 'response_body'].forEach((p) => {
    dataToLog[p] = JSON.stringify(dataToLog[p]);
  });

  BigQuery.insert(connectionInfo, [dataToLog], { ignoreUnknownValues: true });
}

function determinateIsLoggingEnabled() {
  const containerVersion = getContainerVersion();
  const isDebug = !!(
    containerVersion &&
    (containerVersion.debugMode || containerVersion.previewMode)
  );

  if (!data.logType) {
    return isDebug;
  }

  if (data.logType === 'no') {
    return false;
  }

  if (data.logType === 'debug') {
    return isDebug;
  }

  return data.logType === 'always';
}

function determinateIsLoggingEnabledForBigQuery() {
  if (data.bigQueryLogType === 'no') return false;
  return data.bigQueryLogType === 'always';
}
