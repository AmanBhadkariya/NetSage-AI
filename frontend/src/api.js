const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {
      // Keep the generic message when the server returns no JSON body.
    }
    throw new Error(message);
  }

  return response.json();
}

export function getCases() {
  return request('/cases');
}

export function getDashboard() {
  return request('/dashboard');
}

export function getSettings() {
  return request('/settings');
}

export function diagnoseCase(caseId, mode = 'rules') {
  return request(`/diagnose/${caseId}?mode=${encodeURIComponent(mode)}`);
}

export function getReviews() {
  return request('/reviews');
}

export function saveReview(payload) {
  return request('/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
