# Google Conversion Events Tag for Google Tag Manager Server-Side

The **Google Conversion Events Tag** for Google Tag Manager Server-Side allows you to send conversion events directly to Google's advertising platforms (like Google Ads) using the [Data Manager API](https://developers.google.com/data-manager/api). This server-to-server integration ensures robust and accurate tracking of conversions, independent of client-side restrictions.

The tag is designed to handle both single and multiple conversion event uploads in a single request, with comprehensive support for user data, consent information, ad identifiers, and custom variables.

## How to use the Google Conversion Events Tag

1.  Sign in to the Data Manager API Connection via the Stape admin. [How-to](https://stape.io/solutions/data-manager-api-connection).
2.  Add the **Google Conversion Events Tag** to your server container in GTM.
3.  Set up your **Destination Accounts and Conversion Events**, specifying the Advertising Accounts Customer IDs and the corresponding Conversion Event IDs you want to send data to.
4.  Choose your **Conversion Event Mode**: `Single` to configure one event's data through the UI, or `Multiple` to manually provide a pre-formatted array of events.
5.  Configure the **Conversion Information**, **User Data**, and other relevant parameter groups. The tag can auto-map many of these fields from a standard GA4 or e-commerce data layer.
6.  Add a trigger to fire the tag on the appropriate server-side events (e.g., a purchase event).

## Parameters

### Destination Accounts and Conversion Events
This is where you define which Google Ads accounts and specific conversion actions will receive the data.
-   **Product**: The Google product to send data to (currently Google Ads).
-   **Operating Customer ID**: The ID of the Google Ads account that will receive the conversion.
-   **Customer ID**: The ID of the account used for authorization (e.g., an MCC account). If the operating account is the same as the authorizing account, this can be the same.
-   **Conversion Event ID**: The unique ID for the conversion action in Google Ads.

### Conversion Event Mode
You can send data in two ways:
-   **Single Conversion Event**: Configure the parameters for a single conversion directly in the tag's UI fields.
-   **Multiple Conversion Events**: Provide a complete, pre-formatted JSON array containing data for up to 2000 conversion events. This is useful for batch uploads.

### Conversion Information
This section contains the core details of the conversion.
-   **Parameters**: Includes `Transaction/Order ID`, `Event Timestamp`, `Currency`, and `Conversion Value`.
-   **Auto-mapping**: If enabled, the tag will attempt to automatically populate these fields from the incoming event data (e.g., `transaction_id`, `currency`, `value`).

### User Data
This section is crucial for matching the conversion to a user. You can provide multiple identifiers to improve match rates.
-   **Identifiers**: Includes `Email Address(es)`, `Phone Number(s)`, and `User Address` (First Name, Last Name, Region, Postal Code).
-   **Auto-mapping**: If enabled, the tag will automatically pull user data from common event data keys (e.g., `user_data.email`).
-   **Hashing & Normalization**: The tag automatically normalizes and SHA-256 hashes user identifiers if they are provided in plain text, following Google's formatting guidelines.

### Ad Identifiers
This section allows you to send click identifiers for attribution. It's as important as the User Data parameters for matching the conversion to a user.
-   **Parameters**: `gclid`, `gbraid`, `wbraid`, `Landing Page User Agent`, `Landing Page IP Address` and `Session Attributes`.

### Device Information
You can include device details for the conversion event.
-   **Parameters**: `User Agent` and `IP Address`.

### User Properties
This section provides more context about the customer.
-   **Parameters**: `Customer Type` (New, Returning, or Re-engaged) and `Customer Value Bucket` (Low, Medium, or High).

### Cart Data
This section allows for sending product-level details for e-commerce transactions.
-   **Parameters**: `Merchant Center ID`, `Feed Label`, `Feed Language Code`, `Transaction Discount`, and a list of `Items` with their ID, quantity, and price.

### Custom Variables
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

## Open Source
The **Google Conversion Events Tag for GTM Server-Side** is developed and maintained by the [Stape Team](https://stape.io/) under the Apache 2.0 license.