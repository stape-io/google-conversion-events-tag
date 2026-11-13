# Google Data Manager API Conversion Events Tag for Google Tag Manager Server-Side

The **Google Data Manager API Conversion Events Tag** for Google Tag Manager Server-Side allows you to send conversion events directly to Google's advertising platforms (like Google Ads) using the [Data Manager API](https://developers.google.com/data-manager/api). This server-to-server integration ensures robust and accurate tracking of conversions, independent of client-side restrictions.

The tag sends one conversion event per execution, with comprehensive support for user data, consent information, ad identifiers, call information, and custom variables.

## How to use the Google Data Manager API Conversion Events Tag

1.  Choose the authentication method:
    *  **Stape Google Connection (recommended)**: sign in to the Data Manager API Connection via the Stape admin. This is the easiest way to set up the authentication. [How-to](https://stape.io/solutions/data-manager-api-connection).
    *  **Own Google Credentials**: a [Service Account impersonation](https://developers.google.com/data-manager/api/devguides/quickstart/set-up-access?credential_type=service_account) is the simplest way to handle the authentication when using the **Own Google Credentials** method.
        > ℹ️ **CM, DV and SA 360 (Floodlight)** and **Google Analytics (GA4)** destinations are only available with the **Own Google Credentials** authentication method.

        To configure it correctly, you must:
       1) Enable the Data Manager API in a GCP Project.
       2) Create a Service Account in this GCP Project.
       3) Add the `Service Account Token Creator IAM` role (`roles/iam.serviceAccountTokenCreator`) to the Service Account.
       4) Generate a `JSON Key` from this Service Account ([how-to](https://docs.cloud.google.com/iam/docs/keys-create-delete#creating)) and download it.
       5) Connect the Service Account to the container using the `JSON Key` file:
          - If hosting on Stape, [use the **Service Account power-up**](https://stape.io/blog/how-to-connect-google-service-account-to-stape).
          - If NOT hosting on Stape, follow [these instructions](https://developers.google.com/tag-platform/tag-manager/server-side/manual-setup-guide#optional_include_google_cloud_credentials).
       6) Grant the Service Account access to the product you're interacting with (Google Ads account, CM360 account, Google Analytics property etc.).

2.  Add the **Google Data Manager API Conversion Events Tag** to your server container in GTM from the [GTM Template Gallery](https://tagmanager.google.com/gallery/#/owners/stape-io/templates/google-conversion-events-tag).
3.  Choose the **Event Type**: `Conversion` or `Pageview`.
    1.  `Pageview`
    2.  `Conversion`
        1.  Set up your **Destination Accounts and Conversion Events**, specifying the Advertising Accounts Customer IDs and the corresponding Conversion Event IDs you want to send data to.
        2.  Configure the **Conversion Information**, **User Data**, and other relevant parameter groups. The tag can auto-map many of these fields from a standard GA4 or e-commerce data layer.
            > ❗ If using Enhanced Conversions (user email address, user phone number etc.), ensure you do the following in Google Ads (_Goals > Conversions > Settings_) or CM360. These settings must be active for the destination account and its manager (MCC) account, if applicable:
            >    1.  Accept the [Customer Data Terms](https://support.google.com/adspolicy/answer/7475709).
            >    2.  Enable **Enhanced Conversions** and **Enhanced Conversions for Leads**.
        3.  Add a trigger to fire the tag on the appropriate server-side events (e.g., a `page_view` event or a `purchase` event).

## Event Types

### Pageview
This mode sets the `_dm_session_attributes` cookie containing a base64 JSON encoded string with the *Session Attributes* values for conversion event attribution and modeling.
-   **Default mappings**:
    -   Session Attribute `gad_source`: `gad_source` URL Parameter value
    -   Session Attribute `gad_campaignid`: `gad_campaignid` URL Parameter value
    -   Session Attribute `landing_page_url`: `page_location` Event Data value
    -   Session Attribute `landing_page_referrer`: `page_referrer` Event Data value
    -   Session Attribute `landing_page_user_agent`: `user_agent` Event Data value
    -   Session Attribute `session_start_time_usec`: current timestamp of the time when the Pageview tag set the cookie

### Conversion
This mode sends the conversion event.

---

#### Destination Accounts and Conversion Events
This is where you define which advertising accounts and specific conversion actions will receive the data.
-   **Product**: The Google product to send data to. Currently supports **Google Ads**, **CM, DV and SA 360 (Floodlight)**, and **Google Analytics (GA4)** (the latter two, only for the `Own Google Credentials` authentication method).
-   **Operating Customer ID**: The Account ID (without hyphens) of the account that will receive the conversion events.
    -   **Google Ads**: this is your Google Ads Account ID (without hyphens).
    -   **CM360**: this is the [Advertiser ID](https://support.google.com/campaignmanager/answer/11568119?hl=en).
    -   **Google Analytics**: this is the [Property ID](https://developers.google.com/analytics/devguides/reporting/data/v1/property-id#google_analytics).
-   **Customer ID**: The Account ID (without hyphens) of the account used for authorization when making the API request.
    -   **Google Ads**: if your credentials belong to an MCC account that manages the Operating Account, set this to the MCC Account ID. If your credentials belong directly to the Operating Account, you can leave this field empty.
    -   **CM360**: this is also the [Advertiser ID](https://support.google.com/campaignmanager/answer/11568119?hl=en). If your credentials are for a Manager Account that manages the Operating Account, set this to the Manager Account ID.
    -   **Google Analytics**: this is also the [Property ID](https://developers.google.com/analytics/devguides/reporting/data/v1/property-id#google_analytics), and you can leave it blank.
-   **Conversion Event ID**: The ID of the specific conversion action to receive data.
    -   **Google Ads**: navigate to *Google Ads account > Goals > Conversions > Summary* and click on the desired Conversion Action. The ID is the value of the `ctId` query parameter in your browser's URL. [Learn more](https://developers.google.com/data-manager/api/devguides/concepts/destinations#ads-event).
    -   **CM360 (Floodlight)**: this is the **Floodlight Activity ID**. Find it on the *Activities* page — the ID is the number shown next to the activity name in the Activity name column. [Learn more](https://developers.google.com/data-manager/api/devguides/concepts/destinations#floodlight-event).
    -   **Google Analytics**: this is the [Measurement ID](https://support.google.com/analytics/answer/12270356) (for web streams) or the [Firebase App ID](https://developers.google.com/data-manager/api/devguides/concepts/destinations#ga-event) (for app streams).

> ❗ **CM360 service account permissions**: the service account used for authentication must have a user role with the **Insert offline conversions** permission granted in CM360. [Learn more](https://developers.google.com/data-manager/api/devguides/concepts/destinations#cm3-credentials).

---

#### Conversion Information
This section contains the core details of the conversion.
-   **Parameters**: Includes `Event Source`, `Transaction/Order ID`, `Event Timestamp`, `Currency`, and `Conversion Value`.
    -   **Event Source**: a signal for where the event happened originally (`WEB`, `APP`, `IN_STORE`, `PHONE`, or `OTHER`). GA4 events only support `WEB` and `APP`.
    -   **Auto-mapping**: If enabled, the tag will attempt to automatically populate these fields from the incoming event data (e.g., `transaction_id`, `currency`, `value`).
-   **Google Analytics Required Data** (`Own Google Credentials` only): a table to set fields required when Google Analytics (GA4) is a destination — `Event Name` (required), `User ID`, `Client ID` (required for web streams), and `App Instance ID` (required for app streams).

---

#### User Data
This section is crucial for matching the conversion to a user. You can provide multiple identifiers to improve match rates.
-   **Identifiers**: Includes `Email Address(es)`, `Phone Number(s)`, and `User Address` (First Name, Last Name, Region, Postal Code).
    -   **Auto-mapping**: If enabled, the tag will automatically pull user data from common event data keys (e.g., `user_data.email`).
-   **Google Analytics Additional Address Data** (`Own Google Credentials` only): optional `Administrative Area` (state/province), `City` and `Address Line` (street and number) for Google Analytics (GA4) destinations. They're sent only together with the User Address. When auto-mapping is enabled, they're pulled from `user_data.address.region`, `user_data.address.city` and `user_data.address.street`. [Learn more](https://developers.google.com/data-manager/api/reference/rest/v1/UserData#AddressInfo).
-   **Hashing & Normalization**: The tag automatically normalizes and SHA-256 hashes user identifiers if they are provided in plain text, following Google's formatting guidelines.

---

#### Ad Identifiers
This section allows you to send click identifiers for attribution. It's as important as the User Data parameters for matching the conversion to a user.
-   **Click IDs**: `gclid`, `gbraid`, `wbraid` and `dclid` (for Floodlight). `gclid` can also be used for Google Analytics (GA4) events sent as an additional data source. [Learn more](https://developers.google.com/data-manager/api/devguides/events/analytics/online).
    -   **Auto-mapping**: If enabled, the tag will automatically pull Click IDs from, in this order, Event Data > URL Parameter > Server Cookie > JavaScript Cookie.
-   **Other Floodlight-specific Identifiers** (`Own Google Credentials` only): `Match ID`, `Impression ID`, and `Encrypted User ID`.
-   **Other Identifiers**: `Mobile Device ID` and `Lead ID` (the Google-generated ID issued when a user submits a lead form).
-   **Landing Page Parameters and Session Attributes**: `Landing Page User Agent`, `Landing Page IP Address` and `Session Attributes`
    -   **Auto-mapping**: If enabled, the tag will automatically pull Session Attributes from, in this order: `session_attributes` Event Data value > `_dm_session_attributes` Common Cookie value > `_dm_session_attributes` cookie set by the Pageview event of this tag.

> Note: for **Google Ads** and **Floodlight** destinations, at least one Ad Identifier or User Data value must be specified. For **Google Ads**, the Device Information `IP Address` (below) also counts as a valid identifier, except for `IN_STORE` events.

---

#### Device Information
You can include device details for the conversion event.
-   **Parameters**: `User Agent` and `IP Address`.

---

#### User Properties
This section provides more context about the customer.
-   **Parameters**: `Customer Type` (New, Returning, or Re-engaged) and `Customer Value Bucket` (Low, Medium, or High).
-   **Google Analytics User Properties** (`Own Google Credentials` only): a table to send additional [user properties](https://developers.google.com/analytics/devguides/collection/protocol/ga4/user-properties) as `User Property Name`/`User Property Value` pairs.

---

#### Cart Data
This section allows for sending product-level details for e-commerce transactions.
-   **Parameters**: `Merchant Center ID`, `Feed Label`, `Feed Language Code`, `Transaction Discount`, and a list of `Items` with their `Item ID`, `Merchant Product ID`, `Item Quantity`, and `Price`.
    -   **Auto-mapping**: If enabled, the tag will automatically pull `Items` from Event Data.
-   **Add other Item Parameters**: If enabled, any item property that isn't `Item ID`, `Merchant Product ID`, `Item Quantity`, or `Price` is also sent per item as `additionalItemParameters` (used by Google Analytics) and `customVariables` (used by Google Ads and Floodlight).

> Note: it's **required** to send at least the **Item ID** or the **Merchant Product ID** for each item.

---

#### Custom Variables
This section allows you to send any additional key-value pairs for custom reporting.
-   **Parameters**: A list of `Variable ID`, `Variable Value`, and optional `Destination References`.

##### How to obtain the `Variable ID`
<details>
    <summary>⬇️ Click to expand ⬇️</summary>
    <br/>

There are 2 simple ways to obtain the Custom Variable ID.

**1 - Using Scripts in Google Ads UI**

1. Open Google Ads.
2. Go to _Tools > Bulk Actions > Scripts_. Tip: use the search bar at the top.
3. Click the `+` button to a new script and give it a descriptive name.
4. Paste this code in the script code block:
```js
function main() {
const query = `
    SELECT
    conversion_custom_variable.id,
    conversion_custom_variable.name,
    conversion_custom_variable.tag,
    conversion_custom_variable.status
    FROM conversion_custom_variable
`;

const searchResults = AdsApp.search(query);

console.log('------------------------------------------------------------------------------------------------------');
console.log('# CUSTOM VARIABLES INFORMATION #');
console.log('------------------------------------------------------------------------------------------------------');
console.log(
    'NAME'.padEnd(30) + ' | ' +
    'TAG STRING'.padEnd(20) + ' | ' +
    'STATUS'.padEnd(18) + ' | ' +
    'ID (Use this in GTM!)'
);
console.log('------------------------------------------------------------------------------------------------------');

let count = 0;
while (searchResults.hasNext()) {
    const row = searchResults.next().conversionCustomVariable;
    const status = row.status;
    const name = row.name.padEnd(30);
    const tag = row.tag.padEnd(20);
    const id = row.id;
    console.log(`${name} | ${tag} | ${status.padEnd(18)} | ${id}`);
    count++;
}

if (count === 0) console.log('No custom variables found in this account.');

console.log('------------------------------------------------------------------------------------------------------');
}
```
5. Give it the requested permissions through the `Authorize` button.
6. Click `Preview`. There's no need to click `Run`.
7. Go to the `Logs` tab. This is where the **Custom Variable ID** will show up.

    Example:

    ![Google Ads script logs](https://github.com/user-attachments/assets/018a102c-53d2-4476-aa95-c15ea0cdbebd)

8. Use the **Custom Variable ID** in the `Variable ID` field of the tag **Custom Variables** section.

**2 - Using DevTools**

1. Open Google Ads.
2. Go to _Goals > Conversions > Custom Variables_. Tip: use the search bar at the top.
3. Open DevTools and go to the Network tab.
4. In the Network tab, search for `ConversionCustomVariableService/List`.
6. Reload the Custom Variables page.
7. The Network panel should display a request (filtered by the filter added in step 4).
8. Click on this request and go to the `Response` tab.
9. The Custom Variable information will be in the array value of the key named `"1"`. Each item in the array is a custom variable.
10. The **Custom Variable ID** is the key `"1"` inside the object. The Custom Variable Name is the key `"4"`.

    Example:

    ![Google Ads DevTools](https://github.com/user-attachments/assets/47c3001b-51aa-40bc-b11f-04d3c3654ef8)

11. Use the **Custom Variable ID** in the `Variable ID` field of the tag **Custom Variables** section.
</details>

---

#### Google Analytics Event Parameters
Available only for the `Own Google Credentials` authentication method.
This section lets you send any [GA4 event parameters](https://developers.google.com/data-manager/api/reference/analytics/recommended-events) that aren't captured by the other fields (e.g., `tax`, `shipping`).
-   **Parameters**: A list of `Field Name` and `Field Value` pairs.

---

#### Call Info
This section is used to send Google Ads [call conversions](https://support.google.com/google-ads/answer/6275629).
-   **Parameters**: `Start Timestamp`, the time the phone call that led to the conversion started. It's required when Call Info is sent, and accepts RFC 3339 or Unix timestamps (in seconds or milliseconds).

> Note: for call conversions, the conversion action must be of type `UPLOAD_CALLS` (_Call from Ads_ in the Google Ads UI), the **Event Timestamp** must not be earlier than the Start Timestamp, the **User Data** must include the caller's phone number, and **User Data Encryption** must stay disabled. Setting the **Event Source** to `PHONE` is recommended. [Learn more](https://developers.google.com/data-manager/api/devguides/events/google-ads/call/send-events).

---

### Advanced Options

* **Validate Only**: If `true`, the request is validated by the API but not executed. This is useful for debugging.
* **Use Optimistic Scenario**: If `true`, the tag fires `gtmOnSuccess()` immediately without waiting for a response from the API. This speeds up container response time but may hide downstream errors.
* **Request-level Consent**: Apply `adUserData` and `adPersonalization` consent statuses to the conversion event in the request.
* **Consent Settings**: Prevent the tag from firing unless the necessary ad storage consent is granted by the user.

## Useful Resources
* [Step-by-step guide on how to configure Google Data Manager API Conversion Events Tag](https://stape.io/helpdesk/documentation/configure-google-conversion-events-tag)
* [Stape's Data Manager API Connection](https://stape.io/solutions/data-manager-api-connection)
* [Data Manager API for Conversion Events](https://developers.google.com/data-manager/api/reference/rest/v1/events)
* [Conversion Event definition](https://developers.google.com/data-manager/api/reference/rest/v1/events/ingest#Event)
* [User Identifiers Normalization Guidelines](https://developers.google.com/data-manager/api/get-started/formatting)
* Session Attributes: [[1]](https://support.google.com/google-ads/answer/16194756?hl=en) and [[2]](https://developers.google.com/data-manager/api/reference/rest/v1/events/ingest#AdIdentifiers)

## Open Source
The **Google Data Manager API Conversion Events Tag for GTM Server-Side** is developed and maintained by the [Stape Team](https://stape.io/) under the Apache 2.0 license.

### GTM Gallery Status
🟢 [Listed](https://tagmanager.google.com/gallery/#/owners/stape-io/templates/google-conversion-events-tag)
