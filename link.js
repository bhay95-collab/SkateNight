/* ============================================================
   LINK - the control window and the crowd screen talk over a
   BroadcastChannel: same laptop, same browser, no internet needed.
   The control window sends; the crowd screen only listens (and says
   hello when it opens, so it is sent the current picture).
   ============================================================ */
const CHANNEL = 'skate-by-faith';

export function createLink() {
  let channel = null;
  try { channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null; } catch { channel = null; }
  return {
    available: Boolean(channel),
    send(type, data = null) {
      try { channel?.postMessage({ type, data }); } catch (err) { console.warn('[link]', err); }
    },
    listen(fn) {
      if (!channel) return;
      channel.onmessage = (e) => {
        try { fn(e.data || {}); } catch (err) { console.warn('[link]', err); }
      };
    },
  };
}

export const isCrowdView = () => new URLSearchParams(location.search).get('view') === 'crowd';
