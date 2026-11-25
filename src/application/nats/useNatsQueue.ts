import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../../shared/formatters.ts';
import { refineClient } from '../refine/client.ts';
import {
  applyLiveQueueItem,
  natsClient,
  type NatsConnectionState,
  type NatsQueueItem,
  type NatsQueueSnapshot,
} from './natsClient.ts';

export function useNatsQueue(
  tenantId: string,
  onNotify: (msg: string, tone?: 'ok' | 'err') => void
) {
  const [snapshot, setSnapshot] = useState<NatsQueueSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionState, setConnectionState] = useState<NatsConnectionState>(() =>
    natsClient.getState()
  );
  const [livePaused, setLivePaused] = useState(false);
  const [lastPulseAt, setLastPulseAt] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await refineClient.request<NatsQueueSnapshot>('/api/nats/queue');
      setSnapshot(snap);
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка загрузки очереди NATS'), 'err');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    void refresh();
  }, [tenantId, refresh]);

  useEffect(() => {
    setConnectionState(natsClient.getState());
    const unsubState = natsClient.onStateChange((state) => {
      setConnectionState(state);
    });
    const unsubQueue = natsClient.subscribeQueue((item) => {
      if (livePaused) return;
      setLastPulseAt(Date.now());
      setSnapshot((prev) => applyLiveQueueItem(prev, item));
    });
    return () => {
      unsubState();
      unsubQueue();
    };
  }, [livePaused]);

  const publishEvent = useCallback(
    async (params: { subject: string; payload: Record<string, unknown>; simulateError: boolean }) => {
      const res = await refineClient.request<{ item: NatsQueueItem | null; snapshot: NatsQueueSnapshot }>(
        '/api/nats/publish',
        {
          method: 'POST',
          body: JSON.stringify(params),
        }
      );
      setSnapshot(res.snapshot);
      setLastPulseAt(Date.now());
      onNotify(
        params.simulateError
          ? `Событие ${params.subject} зафиксировано со сбоем консьюмера`
          : `Событие ${params.subject} доставлено в очередь NATS`
      );
    },
    [onNotify]
  );

  const replayMessage = useCallback(
    async (id: string) => {
      try {
        const res = await refineClient.request<{ item: NatsQueueItem; snapshot: NatsQueueSnapshot }>(
          `/api/nats/queue/${id}/replay`,
          { method: 'POST' }
        );
        setSnapshot(res.snapshot);
        setLastPulseAt(Date.now());
        onNotify(`Сообщение ${res.item.subject} повторно отправлено в очередь`);
      } catch (err: unknown) {
        onNotify(getErrorMessage(err, 'Ошибка повторной отправки'), 'err');
      }
    },
    [onNotify]
  );

  const togglePause = useCallback(() => {
    setLivePaused((p) => !p);
  }, []);

  return {
    snapshot,
    setSnapshot,
    loading,
    connectionState,
    livePaused,
    lastPulseAt,
    refresh,
    togglePause,
    publishEvent,
    replayMessage,
  };
}
