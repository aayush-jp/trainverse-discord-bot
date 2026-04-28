# Trainverse Discord Bot

## What This Bot Does
Verifies Shopify ebook purchases and assigns Discord roles.
When a user clicks the "Verify" button in the #verify channel,
a modal pops up asking for their email. The bot checks the
Shopify Admin API to confirm they purchased the ebook product.
If confirmed, they receive the "Member" role.

## Tech Stack
- Runtime: Node.js v18+
- Discord library: discord.js v14
- Shopify: Admin GraphQL API with Client Credentials Grant
- Config: dotenv (.env file)

## Rules
- Never hardcode tokens or secrets — always use .env
- Keep all credentials out of source files
- The verify flow is: button → modal (email input) → Shopify check → role assignment
- Verified emails must be stored in a local JSON file to prevent abuse/sharing
- All bot replies must be ephemeral (only visible to the user who clicked)
- Normalize emails before checking (trim whitespace, lowercase)

## Shopify Authentication — Client Credentials Grant
Do NOT use a static Admin API token. Instead:
1. Read SHOPIFY_SHOP, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET from .env
2. Before every Shopify API call, POST to:
   https://{SHOPIFY_SHOP}.myshopify.com/admin/oauth/access_token
   with body: grant_type=client_credentials, client_id, client_secret
3. Cache the returned access_token and its expiry (expires_in is 86399 seconds / ~24 hours)
4. Refresh the token automatically if it's within 60 seconds of expiring
5. Use the token in the X-Shopify-Access-Token header on all API requests

## Shopify Order Check Logic
- Query the GraphQL Admin API for orders where the customer email matches
- Check if any order contains the ebook product (SHOPIFY_PRODUCT_ID)
- Only count orders with a financial_status of PAID
- If found → assign role, save email to verified.json, reply with success
- If not found → reply with rejection (ephemeral)
- If already in verified.json → reply that they're already verified, skip Shopify check
- If Shopify is unreachable or returns an error → reply with "Verification temporarily unavailable, try again later"

## Edge Cases to Handle
- Email with extra spaces or uppercase → normalize before checking
- User already has the Member role → tell them they're already verified
- Shopify API down → friendly error message, do not crash
- Duplicate verified email → block and inform user

## Bot Commands
- /setup → posts the Verify button embed to the #verify channel (admin only)

## Environment Variables
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
DISCORD_ROLE_ID=
DISCORD_VERIFY_CHANNEL_ID=
SHOPIFY_SHOP=yourstore
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_PRODUCT_ID=
