// ===== Visitor Analytics =====
const Analytics = {
  async track(page) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `ffmena_visit_${today}_${page}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');

      const ua = navigator.userAgent;
      const device = /ipad|tablet/i.test(ua) ? 'tablet'
                   : /mobile|android|iphone|ipod/i.test(ua) ? 'mobile'
                   : 'desktop';

      let ip = 'unknown', country = 'unknown', city = 'unknown';
      try {
        const geo = await fetch('https://ipapi.co/json/');
        if (geo.ok) {
          const g = await geo.json();
          ip = g.ip || 'unknown';
          country = g.country_name || 'unknown';
          city = g.city || 'unknown';
        }
      } catch (_) {}

      const visit = {
        ts: Date.now(),
        date: today,
        page,
        device,
        ip,
        country,
        city,
        ref: document.referrer ? document.referrer.split('/')[2] || 'direct' : 'direct'
      };

      await db.ref('analytics/visits').push(visit);
      await db.ref(`analytics/daily/${today}`).transaction(v => (v || 0) + 1);
      await db.ref('analytics/total').transaction(v => (v || 0) + 1);
    } catch (e) {
      // analytics errors must not break the app
    }
  },

  async getDailyStats() {
    const snap = await db.ref('analytics/daily').once('value');
    return snap.val() || {};
  },

  async getTotal() {
    const snap = await db.ref('analytics/total').once('value');
    return snap.val() || 0;
  },

  async getToday() {
    const today = new Date().toISOString().split('T')[0];
    const snap = await db.ref(`analytics/daily/${today}`).once('value');
    return snap.val() || 0;
  },

  async getRecentVisits(limit = 50) {
    const snap = await db.ref('analytics/visits').limitToLast(limit).once('value');
    const data = snap.val() || {};
    return Object.values(data).reverse();
  },

  async getWeek() {
    const daily = await this.getDailyStats();
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      total += daily[key] || 0;
    }
    return total;
  },

  async getMonth() {
    const daily = await this.getDailyStats();
    let total = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      total += daily[key] || 0;
    }
    return total;
  }
};
