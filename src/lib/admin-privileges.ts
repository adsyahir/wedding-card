/**
 * Who may send the Mailjet test email.
 *
 * Restricted to one named account rather than every admin. The button
 * spends real Mailjet quota and puts mail in the family's inboxes, and the
 * other accounts exist so relatives can read RSVPs and moderate ucapan —
 * not to exercise the mail provider.
 *
 * A NAMED USERNAME, NOT A ROLE COLUMN, because there is no roles concept in
 * this app and inventing one for a single button would be the larger
 * change. The trade is real and worth naming: whoever holds the `admin`
 * login has this, and renaming that account silently removes it. If a
 * second privileged action ever appears, that is the point to add a proper
 * `role` to `admin_users` rather than extend this list.
 *
 * Not `server-only`: the settings panel imports it to decide whether to
 * render the button at all. The server re-checks on every request — hiding
 * a control is presentation, never the boundary.
 */
export const TEST_EMAIL_USERNAME = "admin";

/** Case-insensitive: usernames are stored as typed, and "Admin" is the same account to a person. */
export function canSendTestEmail(username: string | null | undefined): boolean {
  return typeof username === "string" && username.trim().toLowerCase() === TEST_EMAIL_USERNAME;
}
