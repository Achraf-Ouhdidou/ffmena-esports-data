const ApiClient = {
  baseUrl: String(window.FFMENA_CONFIG?.apiBaseUrl || '/api/v1').replace(/\/$/, ''),

  async request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method || 'GET',
        credentials: 'include',
        cache: 'no-cache',
        headers: options.body ? { 'Content-Type': 'application/json' } : {},
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      const payload = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(payload?.error?.message || 'Request failed. Please try again.');
        error.status = response.status;
        error.code = payload?.error?.code || 'REQUEST_FAILED';
        throw error;
      }
      return payload;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The server took too long to respond.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
};

const AuthService = {
  getSession() {
    return ApiClient.request('/auth/session');
  },

  login(email, password) {
    return ApiClient.request('/auth/login', { method: 'POST', body: { email, password } });
  },

  logout() {
    return ApiClient.request('/auth/logout', { method: 'POST' });
  }
};