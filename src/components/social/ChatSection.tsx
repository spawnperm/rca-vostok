import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Hash, Plus, Send, MessageSquare, X, Smile } from 'lucide-react';
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
  onCreate: (name: string) => Promise<void>;
  canCreate: boolean;
}) {
  const [creating, setCreating] = useState<boolean>(false);
  const [name, setName] = useState<string>('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length < 2) return;
    await onCreate(name.trim());
    setName('');
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
        <form onSubmit={submit} className="px-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="название канала"
            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
          />
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
  onReact,
  onOpenThread,
}: {
  message: ChatMessageData;
  isMine: boolean;
  canModerate: boolean;
  onReact: (messageId: string, emoji: string) => void;
  onOpenThread: (message: ChatMessageData) => void;
}) {
  const [showEmoji, setShowEmoji] = useState<boolean>(false);
  const palette = ['👍', '❤️', '🔥', '🎉', '👏', '🙏'];

  return (
    <li className={`flex gap-3 px-3 py-2 rounded-lg ${isMine ? 'bg-teal-50/40' : ''}`}>
      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
        {message.authorName.slice(0, 1).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xs font-semibold text-slate-900">{message.authorName}</span>
          <span className="text-[10px] text-slate-400">
            {new Date(message.createdAt).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {message.editedAt && <span className="text-[10px] text-slate-400">изменено</span>}
        </div>

        {message.body ? (
          <p className="text-sm text-slate-800 whitespace-pre-line break-words">{message.body}</p>
        ) : (
          <p className="text-xs italic text-slate-400">сообщение удалено</p>
        )}

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

          {message.replyCount > 0 && (
            <button
              type="button"
              onClick={() => onOpenThread(message)}
              className="inline-flex items-center gap-1 text-[11px] text-teal-700 hover:text-teal-900 font-medium cursor-pointer"
            >
              <MessageSquare className="w-3 h-3" aria-hidden="true" />
              {message.replyCount} в треде
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenThread(message)}
            className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Ответить
          </button>
        </div>
      </div>
    </li>
  );
}

export function ChatSection({ canUseChat, canCreateChannel }: { canUseChat: boolean; canCreateChannel: boolean }) {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [active, setActive] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [threadRoot, setThreadRoot] = useState<ChatMessageData | null>(null);
  const [threadMessages, setThreadMessages] = useState<ChatMessageData[]>([]);
  const [draft, setDraft] = useState<string>('');
  const [threadDraft, setThreadDraft] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadChannels = useCallback(async () => {
    try {
      const res = await chatApi.channels();
      setChannels(res.channels);
      setActive((current) => current ?? res.channels[0] ?? null);
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось загрузить каналы.');
    }
  }, []);

  useEffect(() => {
    if (!canUseChat) return;
    void loadChannels();
  }, [canUseChat, loadChannels]);

  const loadMessages = useCallback(async (channel: ChatChannel) => {
    try {
      const res = await chatApi.messages(channel.id);
      setMessages(res.messages);
      setError(null);
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось загрузить сообщения.');
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void loadMessages(active);

    // Polling keeps the view current without a WebSocket server.
    const timer = setInterval(() => void loadMessages(active), POLL_MS);
    return () => clearInterval(timer);
  }, [active, loadMessages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!active || draft.trim().length === 0) return;
    const body = draft.trim();
    setDraft('');
    try {
      const msg = await chatApi.send(active.id, body);
      setMessages((prev) => [...prev, msg]);
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
      const msg = await chatApi.send(active.id, body, threadRoot.id);
      setThreadMessages((prev) => [...prev, msg]);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === threadRoot.id ? { ...m, replyCount: m.replyCount + 1 } : m
        )
      );
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось ответить в тред.');
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
    } catch {
      // Reactions are non-critical; ignore failures silently.
    }
  };

  const createChannel = async (displayName: string) => {
    try {
      const channel = await chatApi.createChannel({ displayName });
      setChannels((prev) => [...prev, channel]);
      setActive(channel);
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
            onSelect={setActive}
            onCreate={createChannel}
            canCreate={canCreateChannel}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {active ? (
            <>
              <div className="px-4 py-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  {active.displayName}
                </h3>
                {active.purpose && (
                  <p className="text-xs text-slate-500 mt-0.5">{active.purpose}</p>
                )}
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto py-2 max-h-[420px]">
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
                        isMine={false}
                        canModerate={false}
                        onReact={react}
                        onOpenThread={openThread}
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
                    isMine={false}
                    canModerate={false}
                    onReact={react}
                    onOpenThread={() => undefined}
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
