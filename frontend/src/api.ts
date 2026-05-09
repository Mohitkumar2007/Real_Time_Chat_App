export interface Contact {
  id: string;
  user_id: string;
  display_name: string;
  name: string;
  avatar?: string;
  online: boolean;
  last_message?: string;
  last_message_at?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  text: string;
  attachment_url?: string;
  attachment_type?: 'image' | 'gif';
  attachment_name?: string;
  reply_to_message_id?: string;
  reply_to_text?: string;
  reply_to_sender_user_id?: string;
  sender_user_id: string;
  recipient_user_id: string;
  status: 'sent' | 'delivered' | 'read';
  created_at: string;
}

export interface AuthenticatedUser {
  id: string;
  user_id: string;
  display_name: string;
  avatar: string;
  token: string;
}

export interface TotpSetup {
  secret: string;
  otpauth_uri: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

function toFriendlyError(detail: unknown, fallback: string) {
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return toFriendlyError(detail[0], fallback);
  if (typeof detail === 'object') {
    const record = detail as Record<string, unknown>;
    if (record.message) return toFriendlyError(record.message, fallback);
    if (record.detail) return toFriendlyError(record.detail, fallback);
    const [field, value] = Object.entries(record)[0] ?? [];
    if (field) {
      const label = field.replaceAll('_', ' ');
      return `${label.charAt(0).toUpperCase()}${label.slice(1)}: ${toFriendlyError(value, fallback)}`;
    }
  }
  return fallback;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch {
    throw new Error('Cannot reach the chat server. Please check that the backend is running.');
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    const detail = contentType.includes('application/json') ? await response.json() : await response.text();
    throw new Error(toFriendlyError(detail, 'Something went wrong. Please try again.'));
  }

  return response.json() as Promise<T>;
}

async function authenticatedRequest<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  return request<T>(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
}

export function setupTotp(payload: {user_id: string}) {
  return request<TotpSetup>('/chat/auth/totp/setup/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function register(payload: {user_id: string; display_name?: string; password: string; totp_secret: string; totp_code: string}) {
  return request<AuthenticatedUser>('/chat/auth/register/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(payload: {user_id: string; password: string; totp_code: string}) {
  return request<AuthenticatedUser>('/chat/auth/login/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateProfile(payload: {display_name?: string; avatar?: string}) {
  const user = getStoredUser();
  if (!user) throw new Error('Login required.');
  return authenticatedRequest<AuthenticatedUser>('/chat/auth/profile/', user.token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function changePassword(payload: {current_password: string; new_password: string}) {
  const user = getStoredUser();
  if (!user) throw new Error('Login required.');
  return authenticatedRequest<{message: string}>('/chat/auth/password/', user.token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listContacts(search = '') {
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const user = getStoredUser();
  if (!user) throw new Error('Login required.');
  return authenticatedRequest<Contact[]>(`/chat/contacts/${query}`, user.token);
}

export function createContact(payload: {user_id: string}) {
  const user = getStoredUser();
  if (!user) throw new Error('Login required.');
  return authenticatedRequest<Contact>('/chat/contacts/', user.token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listMessages(contactUserId: string) {
  const user = getStoredUser();
  if (!user) throw new Error('Login required.');
  return authenticatedRequest<Message[]>(`/chat/contacts/${contactUserId}/messages/`, user.token);
}

export function createMessage(contactUserId: string, payload: {text?: string; attachment_url?: string; attachment_type?: 'image' | 'gif'; attachment_name?: string; reply_to_message_id?: string}) {
  const user = getStoredUser();
  if (!user) throw new Error('Login required.');
  return authenticatedRequest<Message>(`/chat/contacts/${contactUserId}/messages/`, user.token, {
    method: 'POST',
    body: JSON.stringify({status: 'sent', ...payload}),
  });
}

export function setTypingStatus(contactUserId: string, isTyping: boolean) {
  const user = getStoredUser();
  if (!user) throw new Error('Login required.');
  return authenticatedRequest<{is_typing: boolean}>(`/chat/contacts/${contactUserId}/typing/`, user.token, {
    method: 'POST',
    body: JSON.stringify({is_typing: isTyping}),
  });
}

export function getTypingStatus(contactUserId: string) {
  const user = getStoredUser();
  if (!user) throw new Error('Login required.');
  return authenticatedRequest<{is_typing: boolean}>(`/chat/contacts/${contactUserId}/typing/`, user.token);
}

export function getStoredUser() {
  const rawUser = window.localStorage.getItem('chatapp:user');
  if (!rawUser) return null;
  try {
    return JSON.parse(rawUser) as AuthenticatedUser;
  } catch {
    window.localStorage.removeItem('chatapp:user');
    return null;
  }
}

export function storeUser(user: AuthenticatedUser) {
  window.localStorage.setItem('chatapp:user', JSON.stringify(user));
}

export function clearStoredUser() {
  window.localStorage.removeItem('chatapp:user');
}
