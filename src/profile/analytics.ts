// The Profile's "Usage statistics" switch (src/analytics/). On by default; turning it off works signed out too. Signed in,
// it applies to the whole account: the analytics server remembers the choice (and erases what it stored when turned off),
// and every other device follows at its next start.

import { $, showMessage } from '../account/ui';
import { analyticsAvailable, analyticsEnabled, setAnalyticsOff } from '../analytics';
import { loadSession } from '../shared/sync/session';

export function initAnalyticsSwitch(): void {
  // Builds that send nothing (development) have nothing to switch.
  if (!analyticsAvailable()) return;
  $('analytics').hidden = false;
  const box = $<HTMLInputElement>('analytics-on');
  const msg = $('analytics-msg');
  box.checked = analyticsEnabled();

  box.addEventListener('change', () => {
    const on = box.checked;
    const signedIn = !!loadSession();
    box.disabled = true;
    void setAnalyticsOff(!on).then((reached) => {
      if (!signedIn) showMessage(msg, on ? 'Thanks. Usage statistics are on.' : 'Usage statistics are off.');
      else if (reached) showMessage(msg, on ? 'Thanks. Usage statistics are on for your account.' : 'Off on all your devices. What was collected was deleted.');
      else {
        // Off here right away; the account setting needs a connection, so say so instead of pretending.
        if (on) box.checked = analyticsEnabled();
        showMessage(msg, on ? "Couldn't reach the server to turn it on for your account. Try again when you're online." : 'Off on this device. Connect to the internet to turn it off on your other devices too.');
      }
    }).finally(() => { box.disabled = false; });
  });
}
