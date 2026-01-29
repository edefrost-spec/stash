# Stash iOS Shortcut

Save pages to Stash from your iPhone's share sheet.

## Setup

1. Open the Shortcuts app on your iPhone
2. Tap + to create a new shortcut
3. Add these actions:

### Action 1: Receive input
- Type: **Receive** what's passed to the shortcut
- Accept: **URLs** and **Safari web pages**

### Action 2: Get URL
- **Get URLs from** Shortcut Input

### Action 3: Get contents of URL (this saves to Stash)
- URL: `https://YOUR_PROJECT_ID.supabase.co/rest/v1/saves`
- Method: **POST**
- Headers:
  - `apikey`: `YOUR_SUPABASE_ANON_KEY`
  - `Content-Type`: `application/json`
  - `Prefer`: `return=minimal`
- Request Body: **JSON**
  ```json
  {
    "user_id": "YOUR_USER_ID",
    "url": [URLs variable],
    "title": "Saved from iPhone",
    "site_name": "",
    "source": "ios-shortcut"
  }
  ```

### Action 4: Show notification
- "Saved to Stash!"

## Add to Share Sheet

1. Tap the shortcut name at the top
2. Tap the (i) info icon
3. Enable "Show in Share Sheet"
4. Name it "Save to Stash"

Now when you're in Safari (or any app), tap Share → Save to Stash!

---

## Save Types

The iOS shortcut creates basic link saves. Stash supports several save types:

| Type | Description | How to create |
|------|-------------|---------------|
| **Article** | Full article with content | Use Safari/Chrome extension |
| **Product** | Product with price tracking | Use Safari/Chrome extension on product pages |
| **Note** | Quick notes with markdown | Create in Stash web app |
| **Highlight** | Selected text from pages | Use browser extension context menu |
| **Link** | URL bookmark (no content) | iOS shortcut, or extension without content |

## Product Saves

For full product detection with price extraction, use the Safari extension instead of the shortcut. The extension can detect:
- Product prices from schema.org markup
- Currency information
- Availability status
- Clean product descriptions

If you want to manually mark a save as a product via the shortcut, add these fields:

```json
{
  "user_id": "YOUR_USER_ID",
  "url": [URLs variable],
  "title": "Saved from iPhone",
  "site_name": "",
  "source": "ios-shortcut",
  "is_product": true,
  "product_price": "29.99",
  "product_currency": "GBP"
}
```

**Supported currencies**: USD ($), GBP (£), EUR (€), JPY (¥), and more.
