const LOOKUP_LIMIT = 5;

// Digits only, with a leading 0 rewritten to 62 so 0812..., 62812... and +62 812... compare equal.
// LOOKUP_SQL applies the same two steps to the stored column.
function normalizeWhatsapp(value) {
  return String(value).replace(/\D/g, '').replace(/^0/, '62');
}

// Query values arrive as arrays or objects when repeated or bracketed (?email[]=x), so only strings count.
function parseLookupQuery(query = {}) {
  const email = typeof query.email === 'string' ? query.email.trim().toLowerCase() : '';
  const whatsapp = typeof query.whatsapp === 'string' ? normalizeWhatsapp(query.whatsapp) : '';
  return { email, whatsapp, empty: !email && !whatsapp };
}

// Empty parameters are passed as '' and skipped by the guards, so one blank field never matches every row.
const LOOKUP_SQL = `
  select id, name, email, whatsapp, identity_type
    from dim_cust
   where deleted = false
     and (
       ($1 <> '' and lower(trim(email)) = $1)
       or ($2 <> '' and regexp_replace(regexp_replace(coalesce(whatsapp, ''), '\\D', '', 'g'), '^0', '62') = $2)
     )
   order by created_at desc
   limit ${LOOKUP_LIMIT}
`;

module.exports = { LOOKUP_LIMIT, LOOKUP_SQL, normalizeWhatsapp, parseLookupQuery };
