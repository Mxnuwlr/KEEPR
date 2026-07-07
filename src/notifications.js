/**
 * notifications.js — Push-Notification Helpers
 *
 * Stellt lokale Erinnerungen ein (MHD-Warnungen, Mahlzeiten, Training).
 * Verwendet expo-notifications für lokale Scheduled Notifications.
 * Graceful degradation: alle Calls in try/catch — funktioniert auch ohne
 * native Module (Expo Go ohne Dev Build).
 *
 * Exports:
 *   requestNotificationPermission()  — Permission anfragen, gibt boolean zurück
 *   scheduleMHDWarnings(inventory)   — MHD-Ablauf-Erinnerungen für nächste 7 Tage
 *   scheduleMealReminders(enabled)   — Tägliche Mahlzeiten-Erinnerung (12:00)
 *   scheduleTrainingReminder(enabled, hour) — Tägliche Training-Erinnerung
 *   cancelAllNotifications()         — Alle geplanten Notifications löschen
 */

let Notifications = null;
try {
  Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  // Native module not available (Expo Go without dev build)
}

/** Permission anfragen. Gibt true zurück wenn gewährt. */
export async function requestNotificationPermission() {
  try {
    if (!Notifications) return false;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) { return false; }
}

/** Alle geplanten Notifications löschen. */
export async function cancelAllNotifications() {
  try {
    if (!Notifications) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {}
}

/**
 * Plant MHD-Warnungen für Inventarartikel die in ≤5 Tagen ablaufen.
 * Sendet eine gebündelte Notification (nicht eine pro Artikel).
 *
 * @param {Array} inventory - Inventarliste mit {name, mhd}
 * @param {boolean} enabled
 */
export async function scheduleMHDWarnings(inventory, enabled) {
  try {
    if (!Notifications) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.data?.type === 'mhd') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
    if (!enabled || !inventory?.length) return;

    const soon = inventory.filter(item => {
      if (!item.mhd) return false;
      const days = Math.floor((new Date(item.mhd) - new Date()) / 86400000);
      return days >= 0 && days <= 5;
    });
    if (soon.length === 0) return;

    const names = soon.slice(0, 3).map(i => i.name).join(', ');
    const more = soon.length > 3 ? ` +${soon.length - 3} weitere` : '';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${soon.length} Artikel laufen bald ab`,
        body: `${names}${more}`,
        data: { type: 'mhd' },
      },
      trigger: { hour: 9, minute: 0, repeats: true },
    });
  } catch (e) {}
}

/**
 * Plant tägliche Mahlzeiten-Erinnerung um 12:00 Uhr.
 * @param {boolean} enabled
 */
export async function scheduleMealReminders(enabled) {
  try {
    if (!Notifications) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.data?.type === 'meal') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
    if (!enabled) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Mittagessen eintragen',
        body: 'Hast du deine Mahlzeit schon eingetragen?',
        data: { type: 'meal' },
      },
      trigger: { hour: 12, minute: 0, repeats: true },
    });
  } catch (e) {}
}

/**
 * Plant tägliche Training-Erinnerung.
 * @param {boolean} enabled
 * @param {number} hour - Stunde (0–23), Standard 8
 */
export async function scheduleTrainingReminder(enabled, hour = 8) {
  try {
    if (!Notifications) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.data?.type === 'training') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
    if (!enabled) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Zeit fürs Training',
        body: 'Dein Trainingsplan wartet auf dich.',
        data: { type: 'training' },
      },
      trigger: { hour, minute: 0, repeats: true },
    });
  } catch (e) {}
}
