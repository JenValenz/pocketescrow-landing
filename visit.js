// Logs one row per browser session in Pocket Escrow's app_visits table so visits can be counted.
// No IP or personal data. The publishable key is public by design; the table is insert-only.
(function () {
  try {
    var live = ['pocketescrow.org', 'www.pocketescrow.org'];
    if (live.indexOf(location.hostname) === -1) return;
    if (sessionStorage.getItem('pe_visit_logged')) return;
    sessionStorage.setItem('pe_visit_logged', '1');
    var id = localStorage.getItem('pe_visitor_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('pe_visitor_id', id); }
    fetch('https://linuomhsmsivavjnjtrs.supabase.co/rest/v1/app_visits', {
      method: 'POST',
      headers: {
        'apikey': 'sb_publishable_Zyjg10qyl1bcpUuJNdzUug_0EgCoZC4',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        site: 'landing',
        path: location.pathname.slice(0, 300),
        referrer: document.referrer ? document.referrer.slice(0, 500) : null,
        visitor_id: id
      }),
      keepalive: true
    }).catch(function () {});
  } catch (e) {}
})();
