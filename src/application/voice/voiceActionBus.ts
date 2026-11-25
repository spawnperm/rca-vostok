import { useEffect, useRef } from 'react';
import type { PortalSectionId } from '../../presentation/types.ts';
import type { VoiceActionPayload, VoiceSectionActionId } from './voiceNavigation.ts';

export type VoiceSectionActionHandler = (
  actionId: VoiceSectionActionId,
  payload?: VoiceActionPayload
) => boolean | void;

const listenersBySection = new Map<PortalSectionId, Set<VoiceSectionActionHandler>>();

export function subscribeVoiceSectionAction(
  sectionId: PortalSectionId,
  handler: VoiceSectionActionHandler
): () => void {
  let set = listenersBySection.get(sectionId);
  if (!set) {
    set = new Set();
    listenersBySection.set(sectionId, set);
  }
  set.add(handler);
  return () => {
    const current = listenersBySection.get(sectionId);
    if (!current) return;
    current.delete(handler);
    if (current.size === 0) {
      listenersBySection.delete(sectionId);
    }
  };
}

export function dispatchVoiceSectionAction(
  sectionId: PortalSectionId,
  actionId: VoiceSectionActionId,
  payload?: VoiceActionPayload
): boolean {
  const handlers = listenersBySection.get(sectionId);
  if (!handlers || handlers.size === 0) {
    return false;
  }
  let handled = false;
  for (const handler of handlers) {
    const res = handler(actionId, payload);
    if (res !== false) {
      handled = true;
    }
  }
  return handled;
}

export function useVoiceSectionAction(
  sectionId: PortalSectionId,
  handler: VoiceSectionActionHandler
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    return subscribeVoiceSectionAction(sectionId, (actionId, payload) =>
      handlerRef.current(actionId, payload)
    );
  }, [sectionId]);
}
