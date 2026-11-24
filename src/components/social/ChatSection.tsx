import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Hash,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Smile,
  Trash2,
  X,
} from 'lucide-react';
import {
  SocialApiError,
  chatApi,
  type ChatChannel,
  type ChatMessageData,
} from '../../utils/socialApi';

/** Polling interval: short enough to feel live, gentle on a 2-vCPU host. */
const POLL_MS = 5000;

function ChannelList({
  channels,
  activeId,
  onSelect,
  onCreate,
  canCreate,
}: {
  channels: ChatChannel[];
  activeId: string | null;
  onSelect: (channel: ChatChannel) => void;
  onCreate: (input: { displayName: string; purpose?: string }) => Promise<void>;
  canCreate: boolean;
}) {
  const [creating, setCreating] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length < 2) return;
    await onCreate({
      displayName: name.trim(),
      purpose: purpose.trim() || undefined,
    });
    setName('');
    setPurpose('');
    setCreating(false);
  };

  return (
    <aside className="w-full lg:w-64 shrink-0 space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Каналы
        </h3>
        {canCreate && (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            aria-label="Создать канал"
            className="p-1 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={submit} className="px-1 space-y-1.5 pb-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название канала"
            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
          />
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Тема обсуждения (необязательно)"
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-teal-600 focus:outline-none"
          />
          <div className="flex items-center gap-1.5">
            <button
              type="submit"
              disabled={name.trim().length < 2}
              className="flex-1 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              Создать
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setName('');
                setPurpose('');
              }}
              className="px-2.5 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      <ul className="space-y-0.5">
        {channels.map((c) => {
          const active = c.id === activeId;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors cursor-pointer ${
                  active
                    ? 'bg-teal-50 text-teal-900 font-medium'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Hash className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="truncate flex-1">{c.displayName}</span>
                {(c.unreadCount ?? 0) > 0 && (
                  <span className="px-1.5 py-0.5 bg-teal-700 text-white text-[10px] font-bold rounded-full tabular-nums">
                    {c.unreadCount}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function MessageBubble({
  message,
  isMine,
  canModerate,
  allowThread = true,
  onReact,
  onEdit,
  onDelete,
  onOpenThread,
  onSelectAuthor,
}: {
  message: ChatMessageData;
  isMine: boolean;
  canModerate: boolean;
  allowThread?: boolean;
  onReact: (messageId: string, emoji: string) => void;
  onEdit: (messageId: string, body: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onOpenThread: (message: ChatMessageData) => void;
  onSelectAuthor?: (userId: string) => void;
}) {
  const [showEmoji, setShowEmoji] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);
  const [editDraft, setEditDraft] = useState<string>(message.body);
  const [busy, setBusy] = useState<boolean>(false);
  const palette = ['👍', '❤️', '🔥', '🎉', '👏', '🙏'];

  const saveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editDraft.trim() || busy) return;
    setBusy(true);
    try {
      await onEdit(message.id, editDraft.trim());
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`flex gap-3 px-3 py-2 rounded-lg ${isMine ? 'bg-teal-50/45' : ''}`}>
      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
        {message.authorName.slice(0, 1).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          {onSelectAuthor ? (
            <button
              type="button"
              onClick={() => onSelectAuthor(message.authorId)}
              className="text-xs font-semibold text-slate-900 hover:text-teal-700 cursor-pointer"
            >
              {message.authorName}
            </button>
          ) : (
            <span className="text-xs font-semibold text-slate-900">{message.authorName}</span>
          )}
          <span className="text-[10px] text-slate-400 tabular-nums">
            {new Date(message.createdAt).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {message.editedAt && <span className="text-[10px] text-slate-400">изменено</span>}
        </div>

        {editing ? (
          <form onSubmit={saveEdit} className="flex items-center gap-1.5 pt-0.5">
            <input
              autoFocus
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              className="flex-1 px-2.5 py-1 text-sm border border-teal-400 rounded-lg focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || editDraft.trim().length === 0}
              aria-label="Сохранить изменения"
              className="p-1.5 bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditDraft(message.body);
              }}
              aria-label="Отменить редактирование"
              className="p-1.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : message.body ? (
          <p className="text-sm text-slate-800 whitespace-pre-line break-words">{message.body}</p>
        ) : (
          <p className="text-xs italic text-slate-400">сообщение удалено</p>
        )}

        {message.body && !editing && (
          <div className="flex flex-wrap items-center gap-1.5">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onReact(message.id, r.emoji)}
                className={`px-1.5 py-0.5 rounded text-[11px] border transition-colors cursor-pointer ${
                  r.mine
                    ? 'bg-teal-50 border-teal-300 text-teal-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r.emoji} {r.count}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              aria-label="Добавить реакцию"
              className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>

            {showEmoji && (
              <span className="inline-flex gap-0.5 bg-white border border-slate-200 rounded-lg px-1 py-0.5 shadow-sm">
                {palette.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onReact(message.id, emoji);
                      setShowEmoji(false);
                    }}
                    className="px-1 hover:bg-slate-100 rounded cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </span>
            )}

            {allowThread && message.replyCount > 0 && (
              <button
                type="button"
                onClick={() => onOpenThread(message)}
                className="inline-flex items-center gap-1 text-[11px] text-teal-700 hover:text-teal-900 font-medium cursor-pointer"
              >
                <MessageSquare className="w-3 h-3" aria-hidden="true" />
                {message.replyCount} в треде
              </button>
            )}

            {allowThread && (
              <button
                type="button"
                onClick={() => onOpenThread(message)}
                className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Ответить
              </button>
            )}

            {isMine && (
              <button
                type="button"
                onClick={() => {
                  setEditDraft(message.body);
                  setEditing(true);
                }}
                aria-label="Редактировать сообщение"
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <Pencil className="w-3 h-3" aria-hidden="true" />
              </button>
            )}

            {(isMine || canModerate) && (
              <button
                type="button"
                onClick={() => void onDelete(message.id)}
                aria-label="Удалить сообщение"
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-700 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function ChatSection({
  canUseChat,
  canCreateChannel,
  currentUserId = null,
  canModerate = false,
  onSelectAuthor,
}: {
  canUseChat: boolean;
  canCreateChannel: boolean;
  currentUserId?: string | null;
  canModerate?: boolean;
  onSelectAuthor?: (userId: string) => void;
}) {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [active, setActive] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [threadRoot, setThreadRoot] = useState<ChatMessageData | null>(null);
  const [threadMessages, setThreadMessages] = useState<ChatMessageData[]>([]);
  const [draft, setDraft] = useState<string>('');
  const [threadDraft, setThreadDraft] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const joinedChannelIdsRef = useRef<Set<string>>(new Set());
  const prevChannelIdRef = useRef<string | null>(null);
  const shouldStickToBottomRef = useRef<boolean>(true);

  const ensureJoinedPublic = useCallback(async (channel: ChatChannel) => {
    if (channel.type !== 'public') return;
    if (joinedChannelIdsRef.current.has(channel.id)) return;
    try {
      await chatApi.join(channel.id);
      joinedChannelIdsRef.current.add(channel.id);
    } catch {
      // If join fails transiently, send() also falls back cleanly.
    }
  }, []);

  const loadChannels = useCallback(async () => {
    try {
      const res = await chatApi.channels();
      setChannels(res.channels);
      setActive((current) => {
        if (current) {
          return res.channels.find((c) => c.id === current.id) ?? res.channels[0] ?? null;
        }
        return res.channels[0] ?? null;
      });
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось загрузить каналы.');
    }
  }, []);

  useEffect(() => {
    if (!canUseChat) return;
    void loadChannels();
  }, [canUseChat, loadChannels]);

  const loadMessages = useCallback(
    async (channel: ChatChannel) => {
      try {
        const res = await chatApi.messages(channel.id);
        setMessages(res.messages);
        setError(null);
      } catch (err) {
        setError(err instanceof SocialApiError ? err.message : 'Не удалось загрузить сообщения.');
      }
    },
    []
  );

  const refreshActiveThread = useCallback(async () => {
    if (!active || !threadRoot) return;
    try {
      const res = await chatApi.messages(active.id, threadRoot.id);
      setThreadMessages(res.messages);
    } catch {
      // Keep current thread messages on transient poll error.
    }
  }, [active, threadRoot]);

  useEffect(() => {
    if (!active) return;
    const switched = prevChannelIdRef.current !== active.id;
    prevChannelIdRef.current = active.id;
    if (switched) {
      shouldStickToBottomRef.current = true;
    }

    void ensureJoinedPublic(active).then(() => loadMessages(active));

    const timer = setInterval(() => {
      void loadMessages(active);
      void refreshActiveThread();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [active, ensureJoinedPublic, loadMessages, refreshActiveThread]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && shouldStickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldStickToBottomRef.current = distanceToBottom < 48;
  };

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!active || draft.trim().length === 0) return;
    const body = draft.trim();
    setDraft('');
    shouldStickToBottomRef.current = true;
    try {
      await ensureJoinedPublic(active);
      const msg = await chatApi.send(active.id, body);
      setMessages((prev) => [...prev, msg]);
      setError(null);
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось отправить сообщение.');
      setDraft(body);
    }
  };

  const sendThread = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!active || !threadRoot || threadDraft.trim().length === 0) return;
    const body = threadDraft.trim();
    setThreadDraft('');
    try {
      await ensureJoinedPublic(active);
      const msg = await chatApi.send(active.id, body, threadRoot.id);
      setThreadMessages((prev) => [...prev, msg]);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === threadRoot.id ? { ...m, replyCount: m.replyCount + 1 } : m
        )
      );
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось ответить в тред.');
      setThreadDraft(body);
    }
  };

  const openThread = async (message: ChatMessageData) => {
    if (!active) return;
    setThreadRoot(message);
    try {
      const res = await chatApi.messages(active.id, message.id);
      setThreadMessages(res.messages);
    } catch {
      setThreadMessages([]);
    }
  };

  const react = async (messageId: string, emoji: string) => {
    try {
      await chatApi.react(messageId, emoji);
      if (active) await loadMessages(active);
      await refreshActiveThread();
    } catch {
      // Reactions are non-critical.
    }
  };

  const editMessage = async (messageId: string, body: string) => {
    try {
      const updated = await chatApi.edit(messageId, body);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
      setThreadMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
      setError(null);
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось изменить сообщение.');
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      await chatApi.remove(messageId);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, body: '' } : m))
      );
      setThreadMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, body: '' } : m))
      );
      setError(null);
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось удалить сообщение.');
    }
  };

  const createChannel = async (input: { displayName: string; purpose?: string }) => {
    try {
      const channel = await chatApi.createChannel(input);
      joinedChannelIdsRef.current.add(channel.id);
      setChannels((prev) => [...prev, channel]);
      setActive(channel);
      setError(null);
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось создать канал.');
    }
  };

  if (!canUseChat) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-sm text-slate-600">
        Войдите в личный кабинет, чтобы общаться в каналах сообщества.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex flex-col lg:flex-row min-h-[520px]">
        <div className="border-b lg:border-b-0 lg:border-r border-slate-200 p-3 lg:w-64">
          <ChannelList
            channels={channels}
            activeId={active?.id ?? null}
            onSelect={(ch) => setActive(ch)}
            onCreate={createChannel}
            canCreate={canCreateChannel}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {active ? (
            <>
              <div className="px-4 py-3 border-b border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
                    <Hash className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    {active.displayName}
                  </h3>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    участников: {active.memberCount}
                  </span>
                </div>
                {active.purpose && (
                  <p className="text-xs text-slate-500 mt-0.5">{active.purpose}</p>
                )}
              </div>

              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto py-2 max-h-[420px]"
              >
                {messages.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-10">
                    Сообщений пока нет. Напишите первым.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {messages.map((m) => (
                      <MessageBubble
                        key={m.id}
                        message={m}
                        isMine={Boolean(currentUserId) && m.authorId === currentUserId}
                        canModerate={canModerate}
                        onReact={react}
                        onEdit={editMessage}
                        onDelete={deleteMessage}
                        onOpenThread={openThread}
                        onSelectAuthor={onSelectAuthor}
                      />
                    ))}
                  </ul>
                )}
              </div>

              <form onSubmit={send} className="p-3 border-t border-slate-200 flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Написать в #${active.slug}`}
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
                <button
                  type="submit"
                  disabled={draft.trim().length === 0}
                  aria-label="Отправить сообщение"
                  className="px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500 p-8 text-center">
              Выберите канал слева, чтобы начать общение.
            </div>
          )}

          {error && (
            <p role="alert" className="mx-3 mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              {error}
            </p>
          )}
        </div>
      </div>

      {threadRoot && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-xl my-8">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Тред</h3>
              <button
                type="button"
                onClick={() => {
                  setThreadRoot(null);
                  setThreadMessages([]);
                }}
                aria-label="Закрыть тред"
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 max-h-[50vh] overflow-y-auto space-y-2">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-900">{threadRoot.authorName}</p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{threadRoot.body}</p>
              </div>
              <ul className="space-y-1">
                {threadMessages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    isMine={Boolean(currentUserId) && m.authorId === currentUserId}
                    canModerate={canModerate}
                    allowThread={false}
                    onReact={react}
                    onEdit={editMessage}
                    onDelete={deleteMessage}
                    onOpenThread={() => undefined}
                    onSelectAuthor={onSelectAuthor}
                  />
                ))}
              </ul>
              {threadMessages.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">Ответов пока нет.</p>
              )}
            </div>

            <form onSubmit={sendThread} className="p-3 border-t border-slate-200 flex gap-2">
              <input
                value={threadDraft}
                onChange={(e) => setThreadDraft(e.target.value)}
                placeholder="Ответить в треде"
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={threadDraft.trim().length === 0}
                aria-label="Ответить в тред"
                className="px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
