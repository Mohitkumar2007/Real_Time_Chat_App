import {ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  LogOut,
  MessageSquare,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Settings,
  Smile,
  UserPlus,
  Video,
  WifiOff,
  X,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import QRCode from 'qrcode';
import {
  AuthenticatedUser,
  Contact,
  Message,
  TotpSetup,
  changePassword,
  clearStoredUser,
  createContact,
  createMessage,
  getTypingStatus,
  getStoredUser,
  listContacts,
  listMessages,
  login,
  register,
  setTypingStatus,
  setupTotp,
  storeUser,
  updateProfile,
} from './api';

const formatTime = (value?: string) => {
  if (!value) return 'New';
  return new Intl.DateTimeFormat(undefined, {hour: '2-digit', minute: '2-digit'}).format(new Date(value));
};

const passwordChecks = (value: string) => ({
  length: value.length >= 8,
  capital: /[A-Z]/.test(value),
  digit: /\d/.test(value),
  special: /[^A-Za-z0-9]/.test(value),
});

type AuthMode = 'login' | 'register';
type PendingAttachment = {
  url: string;
  type: 'image' | 'gif';
  name: string;
};

const EMOJI_OPTIONS = ['😀', '😂', '😍', '🔥', '👍', '🙏', '🎉', '😎', '🥲', '❤️', '✅', '✨', '🙌', '🤝', '💬', '🚀'];

const summarizeMessage = (message: Message) => message.text || (message.attachment_type === 'gif' ? 'GIF' : 'Image');

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(() => getStoredUser());
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authUserId, setAuthUserId] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authTotpCode, setAuthTotpCode] = useState('');
  const [totpSetup, setTotpSetup] = useState<TotpSetup | null>(null);
  const [totpQrCode, setTotpQrCode] = useState('');
  const [isGeneratingTotp, setIsGeneratingTotp] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<PendingAttachment | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isContactTyping, setIsContactTyping] = useState(false);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [newContactUserId, setNewContactUserId] = useState('');
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showSidebarOnMobile, setShowSidebarOnMobile] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [avatarInput, setAvatarInput] = useState('');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const activeContact = contacts.find((contact) => contact.user_id === activeChatId);
  const currentMessages = activeChatId ? messages[activeChatId] ?? [] : [];
  const filteredContacts = useMemo(() => contacts, [contacts]);
  const errorMessage = error ? error.replace(/[\[\]{}"]/g, '') : null;
  const checks = passwordChecks(authPassword);
  const passwordScore = Object.values(checks).filter(Boolean).length;
  const isStrongPassword = passwordScore === 4;
  const newPasswordChecks = passwordChecks(newPasswordInput);
  const newPasswordScore = Object.values(newPasswordChecks).filter(Boolean).length;
  const isNewPasswordStrong = newPasswordScore === 4;

  const resetSession = () => {
    clearStoredUser();
    setCurrentUser(null);
    setContacts([]);
    setActiveChatId(null);
    setMessages({});
    setSelectedAttachment(null);
    setReplyingTo(null);
    setIsEmojiPickerOpen(false);
    setIsContactTyping(false);
  };

  const loadContacts = useCallback(async (showLoading = true) => {
    if (!currentUser) return;

    if (showLoading) {
      setIsLoadingContacts(true);
      setError(null);
    }

    try {
      const data = await listContacts(searchQuery);
      setContacts(data);
      if (!activeChatId && data.length > 0) {
        setActiveChatId(data[0].user_id);
      }
    } catch (err) {
      if (showLoading) {
        const message = err instanceof Error ? err.message : 'Unable to reach the backend.';
        if (message.includes('Login required')) resetSession();
        setError(message);
      }
    } finally {
      if (showLoading) {
        setIsLoadingContacts(false);
      }
    }
  }, [activeChatId, currentUser, searchQuery]);

  const loadMessagesForContact = useCallback(async (contactUserId: string, showLoading = true) => {
    if (!currentUser) return;

    if (showLoading) {
      setIsLoadingMessages(true);
      setError(null);
    }

    try {
      const data = await listMessages(contactUserId);
      setMessages((prev) => ({...prev, [contactUserId]: data}));
    } catch (err) {
      if (showLoading) {
        const message = err instanceof Error ? err.message : 'Unable to load messages.';
        if (message.includes('Login required')) resetSession();
        setError(message);
      }
    } finally {
      if (showLoading) {
        setIsLoadingMessages(false);
      }
    }
  }, [currentUser]);

  const loadTypingStatus = useCallback(async (contactUserId: string) => {
    if (!currentUser) return;
    try {
      const data = await getTypingStatus(contactUserId);
      setIsContactTyping(data.is_typing);
    } catch {
      setIsContactTyping(false);
    }
  }, [currentUser]);

  const updateTypingStatus = useCallback((isTyping: boolean) => {
    if (!activeChatId || !currentUser) return;
    setTypingStatus(activeChatId, isTyping).catch(() => undefined);
  }, [activeChatId, currentUser]);

  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const timeout = window.setTimeout(() => loadContacts(), 250);
    return () => window.clearTimeout(timeout);
  }, [loadContacts, searchQuery, currentUser?.token]);

  useEffect(() => {
    if (!activeChatId || !currentUser) return;
    loadMessagesForContact(activeChatId);
    loadTypingStatus(activeChatId);
    setSelectedAttachment(null);
    setReplyingTo(null);
    setIsEmojiPickerOpen(false);
    setIsContactTyping(false);
  }, [activeChatId, currentUser?.token, loadMessagesForContact]);

  useEffect(() => {
    if (!currentUser) return;

    const interval = window.setInterval(() => {
      loadContacts(false);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [currentUser?.token, loadContacts]);

  useEffect(() => {
    if (!activeChatId || !currentUser) return;

    const interval = window.setInterval(() => {
      loadMessagesForContact(activeChatId, false);
      loadTypingStatus(activeChatId);
    }, 1500);

    return () => window.clearInterval(interval);
  }, [activeChatId, currentUser?.token, loadMessagesForContact, loadTypingStatus]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      updateTypingStatus(false);
    };
  }, [updateTypingStatus]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeChatId, messages, isContactTyping]);

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    if (!authUserId.trim() || !authPassword || !authTotpCode.trim()) return;
    if (authMode === 'register' && (!totpSetup || !isStrongPassword)) return;

    setError(null);
    try {
      const user =
        authMode === 'register'
          ? await register({
              user_id: authUserId.trim(),
              display_name: authDisplayName.trim() || authUserId.trim(),
              password: authPassword,
              totp_secret: totpSetup.secret,
              totp_code: authTotpCode.trim(),
            })
          : await login({user_id: authUserId.trim(), password: authPassword, totp_code: authTotpCode.trim()});
      storeUser(user);
      setCurrentUser(user);
      setAuthPassword('');
      setAuthTotpCode('');
      setTotpSetup(null);
      setTotpQrCode('');
      setContacts([]);
      setActiveChatId(null);
      setMessages({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to authenticate.');
    }
  };

  const handleGenerateTotp = async () => {
    if (!authUserId.trim()) {
      setError('Enter a username before generating the authenticator key.');
      return;
    }

    setIsGeneratingTotp(true);
    setError(null);
    try {
      const setup = await setupTotp({user_id: authUserId.trim()});
      const qr = await QRCode.toDataURL(setup.otpauth_uri, {margin: 1, width: 192});
      setTotpSetup(setup);
      setTotpQrCode(qr);
      setAuthTotpCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate authenticator key.');
    } finally {
      setIsGeneratingTotp(false);
    }
  };

  const copyTotpSecret = async () => {
    if (!totpSetup) return;
    await navigator.clipboard.writeText(totpSetup.secret);
    setError(null);
  };

  const handleLogout = () => {
    resetSession();
    setError(null);
  };

  const openSettings = () => {
    setDisplayNameInput(currentUser?.display_name ?? '');
    setAvatarInput(currentUser?.avatar ?? '');
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setSettingsMessage(null);
    setError(null);
    setIsSettingsOpen(true);
  };

  const handleUpdateDisplayName = async (event: FormEvent) => {
    event.preventDefault();
    if (!displayNameInput.trim()) {
      setSettingsMessage('Please enter a display name.');
      return;
    }

    setIsSavingSettings(true);
    setSettingsMessage(null);
    setError(null);
    try {
      const updatedUser = await updateProfile({display_name: displayNameInput.trim()});
      storeUser(updatedUser);
      setCurrentUser(updatedUser);
      setSettingsMessage('Display name updated.');
      loadContacts(false);
    } catch (err) {
      setSettingsMessage(err instanceof Error ? err.message : 'Unable to update display name.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSettingsMessage('Please choose a valid image file.');
      return;
    }
    if (file.size > 600_000) {
      setSettingsMessage('Please choose an image smaller than 600 KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarInput(String(reader.result));
      setSettingsMessage('Photo selected. Save it to update your profile.');
    };
    reader.onerror = () => setSettingsMessage('Unable to read that image. Please try another file.');
    reader.readAsDataURL(file);
  };

  const handleUpdatePhoto = async () => {
    if (!avatarInput) {
      setSettingsMessage('Please choose a profile photo.');
      return;
    }

    setIsSavingSettings(true);
    setSettingsMessage(null);
    setError(null);
    try {
      const updatedUser = await updateProfile({avatar: avatarInput});
      storeUser(updatedUser);
      setCurrentUser(updatedUser);
      setSettingsMessage('Profile photo updated.');
      loadContacts(false);
    } catch (err) {
      setSettingsMessage(err instanceof Error ? err.message : 'Unable to update profile photo.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!currentPasswordInput || !newPasswordInput) {
      setSettingsMessage('Enter your current password and a new password.');
      return;
    }
    if (!isNewPasswordStrong) {
      setSettingsMessage('New password must meet all strength requirements.');
      return;
    }

    setIsSavingSettings(true);
    setSettingsMessage(null);
    setError(null);
    try {
      const result = await changePassword({
        current_password: currentPasswordInput,
        new_password: newPasswordInput,
      });
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setSettingsMessage(result.message || 'Password changed successfully.');
    } catch (err) {
      setSettingsMessage(err instanceof Error ? err.message : 'Unable to change password.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCreateContact = async (event: FormEvent) => {
    event.preventDefault();
    if (!newContactUserId.trim()) return;

    setError(null);
    try {
      const contact = await createContact({user_id: newContactUserId.trim()});
      setContacts((prev) => {
        const withoutDuplicate = prev.filter((item) => item.user_id !== contact.user_id);
        return [...withoutDuplicate, contact].sort((a, b) => a.name.localeCompare(b.name));
      });
      setActiveChatId(contact.user_id);
      setNewContactUserId('');
      if (isMobileView) setShowSidebarOnMobile(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add contact.');
    }
  };

  const handleMessageInputChange = (value: string) => {
    setMessageInput(value);
    updateTypingStatus(value.trim().length > 0);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => updateTypingStatus(false), 1400);
  };

  const insertEmoji = (emoji: string) => {
    handleMessageInputChange(`${messageInput}${emoji}`);
    setIsEmojiPickerOpen(false);
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image or GIF file.');
      return;
    }
    if (file.size > 2_500_000) {
      setError('Please choose an image or GIF smaller than 2.5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedAttachment({
        url: String(reader.result),
        type: file.type === 'image/gif' ? 'gif' : 'image',
        name: file.name,
      });
      setError(null);
    };
    reader.onerror = () => setError('Unable to read that file. Please try another image or GIF.');
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async () => {
    if ((!messageInput.trim() && !selectedAttachment) || !activeChatId) return;

    const text = messageInput.trim();
    const attachment = selectedAttachment;
    const replyMessage = replyingTo;
    setMessageInput('');
    setSelectedAttachment(null);
    setReplyingTo(null);
    setIsEmojiPickerOpen(false);
    updateTypingStatus(false);
    setError(null);

    try {
      const savedMessage = await createMessage(activeChatId, {
        text,
        attachment_url: attachment?.url,
        attachment_type: attachment?.type,
        attachment_name: attachment?.name,
        reply_to_message_id: replyMessage?.id,
      });
      setMessages((prev) => ({
        ...prev,
        [activeChatId]: [...(prev[activeChatId] ?? []), savedMessage],
      }));
      const lastMessage = savedMessage.text || (savedMessage.attachment_type === 'gif' ? 'GIF' : 'Image');
      setContacts((prev) =>
        prev.map((contact) =>
          contact.user_id === activeChatId
            ? {...contact, last_message: lastMessage, last_message_at: savedMessage.created_at}
            : contact,
        ),
      );
    } catch (err) {
      setMessageInput(text);
      setSelectedAttachment(attachment);
      setReplyingTo(replyMessage);
      setError(err instanceof Error ? err.message : 'Unable to send message.');
    }
  };

  if (!currentUser) {
    return (
      <div className="bytetalk-bg min-h-[100dvh] w-full overflow-y-auto p-3 font-sans text-slate-950 sm:flex sm:items-center sm:justify-center sm:p-4">
        <form onSubmit={handleAuth} className="glass-card mx-auto w-full max-w-md rounded-2xl p-4 sm:p-7">
          <div className="mb-5 flex items-center gap-3 sm:mb-8">
            <div className="brand-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-950 shadow-lg sm:h-12 sm:w-12">
              <MessageSquare size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="brand-text text-2xl font-bold">ByteTalk</h1>
              <p className="text-sm leading-snug text-slate-500">Username, strong password, and authenticator code.</p>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold sm:mb-6">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setTotpSetup(null);
                setTotpQrCode('');
              }}
              className={`rounded-lg py-2 ${authMode === 'login' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('register')}
              className={`rounded-lg py-2 ${authMode === 'register' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
            >
              Create
            </button>
          </div>

          <label className="mb-3 block text-sm font-medium text-slate-700 sm:mb-4">
            Username
            <input
              className="glass-field mt-2 w-full rounded-xl px-4 py-2.5 text-slate-950 outline-none transition focus:border-teal-300 focus:bg-white/80 focus:ring-2 focus:ring-teal-100 sm:py-3"
              placeholder="for example: mohit_01"
              value={authUserId}
              onChange={(event) => {
                setAuthUserId(event.target.value);
                setTotpSetup(null);
                setTotpQrCode('');
              }}
            />
          </label>

          {authMode === 'register' && (
            <label className="mb-3 block text-sm font-medium text-slate-700 sm:mb-4">
              Display name
              <input
                className="glass-field mt-2 w-full rounded-xl px-4 py-2.5 text-slate-950 outline-none transition focus:border-teal-300 focus:bg-white/80 focus:ring-2 focus:ring-teal-100 sm:py-3"
                placeholder="Your name"
                value={authDisplayName}
                onChange={(event) => setAuthDisplayName(event.target.value)}
              />
            </label>
          )}

          <label className="mb-4 block text-sm font-medium text-slate-700 sm:mb-6">
            Password
            <input
              type="password"
              className="glass-field mt-2 w-full rounded-xl px-4 py-2.5 text-slate-950 outline-none transition focus:border-teal-300 focus:bg-white/80 focus:ring-2 focus:ring-teal-100 sm:py-3"
              placeholder="8+ chars, capital, digit, special"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
            />
          </label>

          {authMode === 'register' && (
            <div className="glass-field mb-4 rounded-xl p-3 sm:mb-5 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Password strength</p>
                  <p className="text-xs text-slate-500">All requirements must pass.</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isStrongPassword ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isStrongPassword ? 'Strong' : `${passwordScore}/4`}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 min-[380px]:grid-cols-2">
                <span className={checks.length ? 'text-emerald-700' : ''}>8 characters minimum</span>
                <span className={checks.capital ? 'text-emerald-700' : ''}>1 capital letter</span>
                <span className={checks.digit ? 'text-emerald-700' : ''}>1 digit</span>
                <span className={checks.special ? 'text-emerald-700' : ''}>1 special character</span>
              </div>
            </div>
          )}

          {authMode === 'register' && (
            <div className="glass-field mb-4 rounded-xl p-3 sm:mb-5 sm:p-4">
              <div className="mb-3 flex flex-col gap-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Authenticator setup</p>
                  <p className="text-xs text-slate-500">Scan the QR code or copy the key into your authenticator app.</p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateTotp}
                  disabled={isGeneratingTotp}
                  className="w-full rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-300 min-[380px]:w-auto"
                >
                  {isGeneratingTotp ? 'Generating' : 'Generate key'}
                </button>
              </div>
              {totpSetup && (
                <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
                  {totpQrCode && <img src={totpQrCode} alt="Authenticator QR code" className="mx-auto h-36 w-36 rounded-lg border border-slate-200 sm:mx-0 sm:h-32 sm:w-32" />}
                  <div className="min-w-0">
                    <p className="mb-2 break-all rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700">{totpSetup.secret}</p>
                    <button type="button" onClick={copyTotpSecret} className="text-xs font-semibold text-emerald-700 hover:text-emerald-600">
                      Copy key
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <label className="mb-5 block text-sm font-medium text-slate-700 sm:mb-6">
            Authenticator code
            <input
              inputMode="numeric"
              maxLength={6}
              className="glass-field mt-2 w-full rounded-xl px-4 py-2.5 text-slate-950 outline-none transition focus:border-teal-300 focus:bg-white/80 focus:ring-2 focus:ring-teal-100 sm:py-3"
              placeholder="6-digit code"
              value={authTotpCode}
              onChange={(event) => setAuthTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </label>

          {errorMessage && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <WifiOff size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            disabled={authMode === 'register' && (!totpSetup || !isStrongPassword)}
            className="brand-gradient flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-slate-950 shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            <UserPlus size={18} />
            {authMode === 'register' ? 'Create account' : 'Login'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bytetalk-bg h-[100dvh] w-full flex items-center justify-center p-0 sm:p-3 md:p-6 font-sans overflow-hidden text-slate-900">
      <div className={`glass-shell flex w-full overflow-hidden ${isMobileView ? 'h-full rounded-none border-0' : 'h-[88vh] max-w-7xl rounded-2xl'}`}>
        <aside className={`${isMobileView ? (showSidebarOnMobile ? 'w-full' : 'hidden') : 'w-[360px]'} glass-side flex flex-col`}>
          <div className="flex shrink-0 items-center justify-between p-4 sm:p-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-white/50 flex items-center justify-center overflow-hidden">
                <img src={currentUser.avatar} alt={currentUser.display_name} />
              </div>
              <div className="min-w-0">
                <p className="font-display text-xs font-bold text-cyan-200">ByteTalk</p>
                <h2 className="truncate text-white font-semibold">{currentUser.display_name}</h2>
                <p className="truncate text-xs text-white/50">@{currentUser.user_id}</p>
              </div>
            </div>
            <div className="flex gap-3 text-white/80 sm:gap-4">
              <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10" title="Reload contacts" onClick={() => loadContacts()}>
                <RefreshCw size={20} className="hover:text-white transition-colors" />
              </button>
              <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10" title="Settings" onClick={openSettings}>
                <Settings size={20} className="hover:text-white transition-colors" />
              </button>
              <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10" title="Logout" onClick={handleLogout}>
                <LogOut size={20} className="hover:text-white transition-colors" />
              </button>
            </div>
          </div>

          <div className="mb-3 shrink-0 px-4 sm:mb-4 sm:px-6">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-2.5 text-white/60" />
              <input
                type="text"
                placeholder="Search contacts..."
                className="glass-field-dark w-full rounded-xl py-2.5 px-10 text-sm text-white placeholder-white/55 outline-none transition focus:border-cyan-200/60 focus:bg-white/15"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>

          <form onSubmit={handleCreateContact} className="mb-3 flex shrink-0 gap-2 px-4 sm:mb-4 sm:px-6">
            <input
              type="text"
              placeholder="Add by username"
              className="glass-field-dark min-w-0 flex-1 rounded-xl py-2.5 px-3 text-sm text-white placeholder-white/55 outline-none transition focus:border-cyan-200/60 focus:bg-white/15"
              value={newContactUserId}
              onChange={(event) => setNewContactUserId(event.target.value)}
            />
            <button className="brand-gradient w-10 h-10 rounded-xl text-slate-950 flex items-center justify-center shadow-lg hover:brightness-105 transition" title="Add contact">
              <Plus size={18} />
            </button>
          </form>

          <div className="flex-1 overflow-y-auto space-y-1 px-2 pb-3 no-scrollbar">
            {isLoadingContacts && <div className="px-4 py-3 text-sm text-white/60">Loading contacts...</div>}

            {filteredContacts.map((contact) => (
              <div
                key={contact.user_id}
                onClick={() => {
                  setActiveChatId(contact.user_id);
                  if (isMobileView) setShowSidebarOnMobile(false);
                }}
                className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all ${activeChatId === contact.user_id ? 'bg-white/18 border border-emerald-300/35 shadow-sm' : 'hover:bg-white/10 border border-transparent'}`}
              >
                <div className="relative shrink-0">
                  <img src={contact.avatar} alt={contact.name} className="w-12 h-12 rounded-full border border-white/20" />
                  {contact.online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-white font-medium text-sm truncate">{contact.name}</span>
                    <span className="text-[10px] text-white/50">{formatTime(contact.last_message_at)}</span>
                  </div>
                  <p className="text-white/70 text-xs truncate">@{contact.user_id} - {contact.last_message || 'No messages yet'}</p>
                </div>
              </div>
            ))}

            {!isLoadingContacts && filteredContacts.length === 0 && (
              <div className="px-4 py-8 text-sm text-white/60">Add another person by username to start chatting.</div>
            )}
          </div>
        </aside>

        <main className={`glass-main flex-1 flex flex-col relative ${isMobileView && showSidebarOnMobile ? 'hidden' : 'flex'}`}>
          {activeChatId && activeContact ? (
            <>
              <header className="glass-topbar flex shrink-0 items-center justify-between gap-3 border-b p-3 sm:p-5">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  {isMobileView && (
                    <button onClick={() => setShowSidebarOnMobile(true)} className="mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100">
                      <ArrowLeft size={24} />
                    </button>
                  )}
                  <div className="relative">
                    <img src={activeContact.avatar} alt={activeContact.name} className="w-10 h-10 rounded-full border border-slate-200 shadow-sm" />
                    {activeContact.online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-slate-950 font-semibold text-sm leading-tight">{activeContact.name}</h3>
                    <p className="text-emerald-600 text-[11px] font-medium">
                      {isContactTyping ? 'typing...' : `@${activeContact.user_id} - active chat`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 text-slate-500 sm:gap-6">
                  <Video size={20} className="hidden cursor-pointer hover:text-slate-900 transition-colors min-[420px]:block" />
                  <Phone size={18} className="hidden cursor-pointer hover:text-slate-900 transition-colors min-[420px]:block" />
                  <div className="hidden sm:block border-l border-slate-200 h-5" />
                  <Search size={20} className="hidden sm:block cursor-pointer hover:text-slate-900 transition-colors" />
                  <MoreVertical size={20} className="cursor-pointer hover:text-slate-900 transition-colors" />
                </div>
              </header>

              {errorMessage && (
                <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <WifiOff size={16} />
                  <span className="truncate">{errorMessage}</span>
                </div>
              )}

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-8 space-y-4 sm:space-y-5 no-scrollbar relative">
                {isLoadingMessages && <div className="text-center text-sm text-slate-500">Loading messages...</div>}
                <AnimatePresence initial={false}>
                  {currentMessages.map((msg) => {
                    const isMine = msg.sender_user_id.toLowerCase() === currentUser.user_id.toLowerCase();
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{opacity: 0, scale: 0.95, y: 10}}
                        animate={{opacity: 1, scale: 1, y: 0}}
                        className={`flex gap-3 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        <div className={`max-w-[86%] min-w-[86px] rounded-2xl border p-3 shadow-sm backdrop-blur-xl sm:max-w-[78%] sm:p-4 ${isMine ? 'border-teal-400/50 bg-gradient-to-br from-teal-600 to-sky-700 rounded-tr-md text-white' : 'bg-white/78 border-white/70 rounded-tl-md text-slate-900'}`}>
                          {msg.reply_to_message_id && (
                            <div className={`mb-2 rounded-xl border-l-4 px-3 py-2 text-xs ${isMine ? 'border-cyan-200 bg-white/15 text-white/80' : 'border-teal-500 bg-slate-100/80 text-slate-600'}`}>
                              <p className="font-semibold">
                                {msg.reply_to_sender_user_id?.toLowerCase() === currentUser.user_id.toLowerCase() ? 'You' : activeContact.name}
                              </p>
                              <p className="line-clamp-2 break-words">{msg.reply_to_text || 'Message'}</p>
                            </div>
                          )}
                          {msg.attachment_url && (
                            <a href={msg.attachment_url} target="_blank" rel="noreferrer" className="mb-2 block overflow-hidden rounded-xl border border-white/30 bg-black/5">
                              <img src={msg.attachment_url} alt={msg.attachment_name || 'Chat attachment'} className="max-h-72 w-full min-w-48 object-cover" />
                            </a>
                          )}
                          {msg.text && <p className="break-words text-sm leading-relaxed">{msg.text}</p>}
                          <div className={`mt-2 flex items-center gap-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <span className={`text-[9px] ${isMine ? 'text-white/55' : 'text-slate-400'}`}>
                              {formatTime(msg.created_at)}
                            </span>
                            {isMine &&
                              (msg.status === 'read' ? (
                                <CheckCheck size={12} className="text-emerald-300" />
                              ) : (
                                <Check size={12} className="text-white/50" />
                              ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyingTo(msg)}
                          className={`mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-slate-500 opacity-70 transition hover:bg-white hover:opacity-100 ${isMine ? 'order-first' : ''}`}
                          title="Reply"
                        >
                          <Reply size={14} />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {!isLoadingMessages && currentMessages.length === 0 && (
                  <div className="h-full flex items-center justify-center text-center text-slate-500 text-sm">
                    Send the first message to {activeContact.name}.
                  </div>
                )}

                {isContactTyping && (
                  <motion.div
                    initial={{opacity: 0, y: 8}}
                    animate={{opacity: 1, y: 0}}
                    className="flex items-center gap-2"
                  >
                    <div className="rounded-2xl rounded-tl-md border border-white/70 bg-white/78 px-4 py-3 shadow-sm backdrop-blur-xl">
                      <div className="typing-dots flex items-center gap-1.5">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              <footer className="glass-footer shrink-0 border-t p-3 sm:p-5">
                {replyingTo && (
                  <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/50 bg-white/70 p-3 shadow-sm backdrop-blur-xl">
                    <div className="min-w-0 flex-1 border-l-4 border-teal-500 pl-3">
                      <p className="text-xs font-semibold text-teal-700">
                        Replying to {replyingTo.sender_user_id.toLowerCase() === currentUser.user_id.toLowerCase() ? 'yourself' : activeContact.name}
                      </p>
                      <p className="truncate text-sm text-slate-700">{summarizeMessage(replyingTo)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-900"
                      title="Cancel reply"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
                {selectedAttachment && (
                  <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/50 bg-white/60 p-2 shadow-sm backdrop-blur-xl">
                    <img src={selectedAttachment.url} alt={selectedAttachment.name} className="h-14 w-14 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{selectedAttachment.name}</p>
                      <p className="text-xs text-slate-500">{selectedAttachment.type === 'gif' ? 'GIF ready to send' : 'Image ready to send'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAttachment(null)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-900"
                      title="Remove attachment"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
                <div className="glass-field relative flex items-center gap-2 rounded-2xl px-3 py-2.5 shadow-sm sm:gap-3 sm:px-4 sm:py-3">
                  {isEmojiPickerOpen && (
                    <div className="absolute bottom-[calc(100%+10px)] left-2 grid w-64 grid-cols-8 gap-1 rounded-2xl border border-white/60 bg-white/90 p-3 shadow-2xl backdrop-blur-xl sm:left-4">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => insertEmoji(emoji)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-slate-100"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsEmojiPickerOpen((value) => !value)}
                    className="text-slate-500 transition-colors hover:text-slate-900"
                    title="Add emoji"
                  >
                    <Smile size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-slate-500 transition-colors hover:text-slate-900"
                    title="Attach image or GIF"
                  >
                    <Paperclip size={22} className="-rotate-45" />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*,.gif" onChange={handleAttachmentChange} className="hidden" />
                  <input
                    type="text"
                    placeholder="Type your message..."
                    className="flex-1 bg-transparent border-none text-slate-900 focus:ring-0 placeholder-slate-400 text-sm outline-none"
                    value={messageInput}
                    onChange={(event) => handleMessageInputChange(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleSendMessage()}
                  />
                  {messageInput.trim() || selectedAttachment ? (
                    <motion.button
                      type="button"
                      whileHover={{scale: 1.05}}
                      whileTap={{scale: 0.95}}
                      onClick={handleSendMessage}
                      className="brand-gradient flex shrink-0 items-center justify-center rounded-xl p-2.5 text-slate-950 shadow-lg transition-all hover:brightness-105"
                    >
                      <Send size={18} />
                    </motion.button>
                  ) : (
                    <button type="button" className="shrink-0 text-slate-500 transition-colors hover:text-slate-900">
                      <Mic size={22} />
                    </button>
                  )}
                </div>
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-5 sm:p-8 text-center">
              {errorMessage && (
                <div className="mb-6 flex max-w-md items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <WifiOff size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}
              <div className="brand-gradient mb-6 flex h-20 w-20 items-center justify-center rounded-3xl shadow-xl sm:mb-8 sm:h-24 sm:w-24">
                <MessageSquare size={42} className="text-slate-950" />
              </div>
              <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Add a contact by username</h1>
              <p className="text-slate-500 text-sm max-w-sm mb-10 leading-relaxed">
                Your chats are loaded after login and stored between your username and the other person&apos;s username.
              </p>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-[0.2em] font-medium">
                <span className="w-8 h-[1px] bg-slate-200" />
                <span>Encrypted Flow + TOTP</span>
                <span className="w-8 h-[1px] bg-slate-200" />
              </div>
            </div>
          )}
        </main>
      </div>

      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="glass-modal max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border shadow-[0_24px_80px_rgba(15,23,42,0.24)] sm:max-h-[92vh] sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Account settings</h2>
                <p className="text-sm text-slate-500">@{currentUser.user_id}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                title="Close settings"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-5">
              {settingsMessage && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {settingsMessage.replace(/[\[\]{}"]/g, '')}
                </div>
              )}

              <form onSubmit={handleUpdateDisplayName} className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">Display name</h3>
                  <p className="text-xs text-slate-500">This name appears to people who add your username.</p>
                </div>
                <input
                  className="glass-field w-full rounded-xl px-4 py-3 text-sm outline-none transition focus:border-teal-300 focus:bg-white/80 focus:ring-2 focus:ring-teal-100"
                  value={displayNameInput}
                  onChange={(event) => setDisplayNameInput(event.target.value)}
                  placeholder="Your display name"
                />
                <button
                  disabled={isSavingSettings}
                  className="brand-gradient rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  Save display name
                </button>
              </form>

              <div className="h-px bg-slate-200" />

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">Profile photo</h3>
                  <p className="text-xs text-slate-500">Upload a small image for your chat profile.</p>
                </div>
                <div className="flex flex-col gap-4 min-[420px]:flex-row min-[420px]:items-center">
                  <img
                    src={avatarInput || currentUser.avatar}
                    alt={currentUser.display_name}
                    className="h-16 w-16 rounded-2xl border border-slate-200 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-950 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
                    />
                    <p className="mt-2 text-xs text-slate-400">Recommended: square image under 600 KB.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleUpdatePhoto}
                  disabled={isSavingSettings}
                  className="brand-gradient rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  Save profile photo
                </button>
              </div>

              <div className="h-px bg-slate-200" />

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">Change password</h3>
                  <p className="text-xs text-slate-500">Enter your current password before setting a new one.</p>
                </div>
                <input
                  type="password"
                  className="glass-field w-full rounded-xl px-4 py-3 text-sm outline-none transition focus:border-teal-300 focus:bg-white/80 focus:ring-2 focus:ring-teal-100"
                  value={currentPasswordInput}
                  onChange={(event) => setCurrentPasswordInput(event.target.value)}
                  placeholder="Current password"
                />
                <input
                  type="password"
                  className="glass-field w-full rounded-xl px-4 py-3 text-sm outline-none transition focus:border-teal-300 focus:bg-white/80 focus:ring-2 focus:ring-teal-100"
                  value={newPasswordInput}
                  onChange={(event) => setNewPasswordInput(event.target.value)}
                  placeholder="8+ chars, capital, digit, special"
                />
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">New password strength</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isNewPasswordStrong ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {isNewPasswordStrong ? 'Strong' : `${newPasswordScore}/4`}
                    </span>
                  </div>
                  <div className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                    <span className={newPasswordChecks.length ? 'text-emerald-700' : ''}>8 characters minimum</span>
                    <span className={newPasswordChecks.capital ? 'text-emerald-700' : ''}>1 capital letter</span>
                    <span className={newPasswordChecks.digit ? 'text-emerald-700' : ''}>1 digit</span>
                    <span className={newPasswordChecks.special ? 'text-emerald-700' : ''}>1 special character</span>
                  </div>
                </div>
                <button
                  disabled={isSavingSettings}
                  className="rounded-xl bg-slate-950/90 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  Change password
                </button>
              </form>

              <div className="flex justify-end border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
