# Google Conversion Events Tag for Google Tag Manager Server-Side

The **Google Conversion Events Tag** for Google Tag Manager Server-Side allows you to send conversion events directly to Google's advertising platforms (like Google Ads) using the [Data Manager API](https://developers.google.com/data-manager/api). This server-to-server integration ensures robust and accurate tracking of conversions, independent of client-side restrictions.

The tag is designed to handle both single and multiple conversion event uploads in a single request, with comprehensive support for user data, consent information, ad identifiers, and custom variables.

## How to use the Google Conversion Events Tag

1.  Choose the authentication method:
    *  **Stape Google Connection (recommended)**: sign in to the Data Manager API Connection via the Stape admin. This is the easiest way to set up the authentication. [How-to](https://stape.io/solutions/data-manager-api-connection).
    *  **Own Google Credentials**: a [Service Account impersonation](https://developers.google.com/data-manager/api/devguides/quickstart/set-up-access?credential_type=service_account) is the simplest way to handle the authentication when using the **Own Google Credentials** method.

        To configure it correctly, you must:
       1) Enable the Data Manager API in a GCP Project.
       2) Create a Service Account in this GCP Project.
       3) Add the `Service Account Token Creator IAM` role (`roles/iam.serviceAccountTokenCreator`) to the Service Account.
       4) Generate a `JSON Key` from this Service Account ([how-to](https://docs.cloud.google.com/iam/docs/keys-create-delete#creating)) and download it.
       5) Connect the Service Account to the container using the `JSON Key` file:
          - If hosting on Stape, [use the **Service Account power-up**](https://stape.io/blog/how-to-connect-google-service-account-to-stape).
          - If NOT hosting on Stape, follow [these instructions](https://developers.google.com/tag-platform/tag-manager/server-side/manual-setup-guide#optional_include_google_cloud_credentials).
       6) Grant the Service Account access to the product you're interacting with (Google Ads, DV360 etc.).

2.  Add the **Google Conversion Events Tag** to your server container in GTM from the [GTM Template Gallery](https://tagmanager.google.com/gallery/#/owners/stape-io/templates/google-conversion-events-tag).
3.  Choose the **Event Type**: `Conversion` or `Pageview`.
    1.  `Pageview`
    2.  `Conversion`
        1.  Set up your **Destination Accounts and Conversion Events**, specifying the Advertising Accounts Customer IDs and the corresponding Conversion Event IDs you want to send data to.
        2.  Choose your **Conversion Event Mode**: `Single` to configure one event's data through the UI, or `Multiple` to manually provide a pre-formatted array of events.
        3.  Configure the **Conversion Information**, **User Data**, and other relevant parameter groups. The tag can auto-map many of these fields from a standard GA4 or e-commerce data layer.
4.  Add a trigger to fire the tag on the appropriate server-side events (e.g., a `page_view` event or a `purchase` event).

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

#### Destination Accounts and Conversion Events
This is where you define which Google Ads accounts and specific conversion actions will receive the data.
-   **Product**: The Google product to send data to (currently Google Ads).
-   **Operating Customer ID**: The ID of the Google Ads account that will receive the conversion.
-   **Customer ID**: The ID of the account used for authorization (e.g., an MCC account). If the operating account is the same as the authorizing account, this can be the same.
-   **Conversion Event ID**: The unique ID for the conversion action in Google Ads.

#### Conversion Event Mode
You can send data in two ways:
-   **Single Conversion Event**: Configure the parameters for a single conversion directly in the tag's UI fields.
-   **Multiple Conversion Events**: Provide a complete, pre-formatted JSON array containing data for up to 2000 conversion events. This is useful for batch uploads.

#### Conversion Information
This section contains the core details of the conversion.
-   **Parameters**: Includes `Transaction/Order ID`, `Event Timestamp`, `Currency`, and `Conversion Value`.
    -   **Auto-mapping**: If enabled, the tag will attempt to automatically populate these fields from the incoming event data (e.g., `transaction_id`, `currency`, `value`).

#### User Data
This section is crucial for matching the conversion to a user. You can provide multiple identifiers to improve match rates.
-   **Identifiers**: Includes `Email Address(es)`, `Phone Number(s)`, and `User Address` (First Name, Last Name, Region, Postal Code).
    -   **Auto-mapping**: If enabled, the tag will automatically pull user data from common event data keys (e.g., `user_data.email`).
-   **Hashing & Normalization**: The tag automatically normalizes and SHA-256 hashes user identifiers if they are provided in plain text, following Google's formatting guidelines.

#### Ad Identifiers
This section allows you to send click identifiers for attribution. It's as important as the User Data parameters for matching the conversion to a user.
-   **Click IDs**: `gclid`, `gbraid` and `wbraid`.
    -   **Auto-mapping**: If enabled, the tag will automatically pull Click IDs from, in this order, Event Data > URL Parameter > Server Cookie > JavaScript Cookie.
-   **Landing Page Parameters and Session Attributes**: `Landing Page User Agent`, `Landing Page IP Address` and `Session Attributes`
    -   **Auto-mapping**: If enabled, the tag will automatically pull Session Attributes from, in this order: `session_attributes` Event Data value > `_dm_session_attributes` Common Cookie value > `_dm_session_attributes` cookie set by the Pageview event of this tag.

#### Device Information
You can include device details for the conversion event.
-   **Parameters**: `User Agent` and `IP Address`.

#### User Properties
This section provides more context about the customer.
-   **Parameters**: `Customer Type` (New, Returning, or Re-engaged) and `Customer Value Bucket` (Low, Medium, or High).

#### Cart Data
This section allows for sending product-level details for e-commerce transactions.
-   **Parameters**: `Merchant Center ID`, `Feed Label`, `Feed Language Code`, `Transaction Discount`, and a list of `Items` with their ID, quantity, and price.

#### Custom Variables
This section allows you to send any additional key-value pairs for custom reporting.
-   **Parameters**: A list of `Variable Name`, `Variable Value`, and optional `Destination References`.

### Advanced Options

* **Validate Only**: If `true`, the request is validated by the API but not executed. This is useful for debugging.
* **Use Optimistic Scenario**: If `true`, the tag fires `gtmOnSuccess()` immediately without waiting for a response from the API. This speeds up container response time but may hide downstream errors.
* **Request-level Consent**: Apply `adUserData` and `adPersonalization` consent statuses to all users in the request. This can be overridden at the user level when using the "Multiple Users" mode.
* **Consent Settings**: Prevent the tag from firing unless the necessary ad storage consent is granted by the user.
* **Logging**: Configure console and/or BigQuery logging for debugging and monitoring requests and responses.

## Useful Resources
* [Stape's Data Manager API Connection](https://stape.io/solutions/data-manager-api-connection)
* [Data Manager API for Conversion Events](https://developers.google.com/data-manager/api/reference/rest/v1/events)
* [Conversion Event definition](https://developers.google.com/data-manager/api/reference/rest/v1/events/ingest#Event)
* [User Identifiers Normalization Guidelines](https://developers.google.com/data-manager/api/get-started/formatting)
* Session Attributes: [[1]](https://support.google.com/google-ads/answer/16194756?hl=en) and [[2]](https://developers.google.com/data-manager/api/reference/rest/v1/events/ingest#AdIdentifiers)

## Open Source
The **Google Conversion Events Tag for GTM Server-Side** is developed and maintained by the [Stape Team](https://stape.io/) under the Apache 2.0 license.