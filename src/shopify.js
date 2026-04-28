const tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const res = await fetch(
    `https://${process.env.SHOPIFY_SHOP}.myshopify.com/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Shopify token request failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  tokenCache.token = data.access_token;
  tokenCache.expiresAt = now + (data.expires_in ?? 86399) * 1000;
  return tokenCache.token;
}

const ORDERS_QUERY = `
  query($query: String!) {
    orders(first: 50, query: $query) {
      edges {
        node {
          displayFinancialStatus
          lineItems(first: 50) {
            edges {
              node {
                product {
                  id
                }
              }
            }
          }
        }
      }
    }
  }
`;

async function checkPurchase(email) {
  const token = await getAccessToken();

  const res = await fetch(
    `https://${process.env.SHOPIFY_SHOP}.myshopify.com/admin/api/2024-01/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: ORDERS_QUERY,
        variables: { query: `email:${email} financial_status:paid` },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Shopify GraphQL request failed: ${res.status} ${res.statusText}`);
  }

  const { data, errors } = await res.json();

  if (errors?.length) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(errors)}`);
  }

  const productId = process.env.SHOPIFY_PRODUCT_ID;
  const orders = data?.orders?.edges ?? [];

  for (const { node: order } of orders) {
    if (order.displayFinancialStatus !== 'PAID') continue;
    for (const { node: item } of order.lineItems.edges) {
      const id = item.product?.id ?? '';
      // Match full GID (gid://shopify/Product/123) or bare numeric ID
      if (id === productId || id.endsWith(`/${productId}`)) {
        return true;
      }
    }
  }

  return false;
}

module.exports = { checkPurchase };
