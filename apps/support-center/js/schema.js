// Single source of truth for ticket choices. Keep in sync with firestore.rules (the server enforces these exact values).
export const CATEGORIES = [
  'Bug or crash',
  'Performance or memory',
  'Website problem in X Orbit',
  'Passwords, cards and autofill',
  'Downloads and installer',
  'Chrome extension',
  'Privacy question',
  'Feature request',
  'Account or something else',
]
export const PRODUCTS = [
  'X Orbit for Mac',
  'X Orbit Chrome extension',
  'Orbit Search',
  'The website',
  'Not sure',
]
export const IMPACTS = [
  'I cannot use X Orbit (crash or will not open)',
  'A feature is broken',
  'It works but looks wrong or feels slow',
  'Just a question or suggestion',
]
export const FREQUENCIES = ['Every time', 'Sometimes', 'Only once']

export const STATUS = {
  open: 'Open',
  pending: 'Waiting for your reply',
  solved: 'Solved',
  closed: 'Closed',
}
export const ADMIN_STATUS = {
  open: 'Open',
  pending: 'Waiting on customer',
  solved: 'Solved',
  closed: 'Closed',
}

export const TIPS = {
  '': [
    'Pick a category and this list adapts.',
    'One problem per ticket is easiest to fix.',
    'Add more detail any time by replying in the ticket.',
  ],
  'Bug or crash': [
    'What you were doing right before it broke.',
    'Does it happen every time? After a restart?',
    'On Mac: Console > Crash Reports > "X Orbit", if one exists. Mention it; we may ask for it.',
    'Does it also happen in a Private window?',
  ],
  'Performance or memory': [
    'How many tabs were open, and which sites.',
    'Activity Monitor (Mac) or Task Manager (Windows): memory used by X Orbit.',
    'Did it start after an update or on a certain site?',
    'Does it still happen with Focus Mode or Split View off?',
  ],
  'Website problem in X Orbit': [
    'The exact page address.',
    'Does the same page work in Chrome?',
    'What breaks: loading, sign-in, video, layout, a button?',
    'Settings > Privacy: is third-party cookie blocking or JavaScript turned off?',
  ],
  'Passwords, cards and autofill': [
    'The site address, not the password. Never send passwords or card numbers.',
    'Did the save prompt appear? Did the fill menu open when you clicked the box?',
    'Is it a normal form, or an embedded payment box?',
    'Mac: is Touch ID asked for?',
  ],
  'Downloads and installer': [
    'Mac with Apple Silicon (M1 or newer) or Intel? Only Apple Silicon is available today.',
    'The exact message macOS shows ("can\'t be opened...").',
    'Did you try System Settings > Privacy & Security > Open Anyway?',
    'The file name you downloaded and where from.',
  ],
  'Chrome extension': [
    'Chrome (or Edge/Brave) version: chrome://version.',
    'Did you pick the unzipped folder that contains manifest.json?',
    'A red "Errors" button on the extension card? Say what it shows.',
    'Which shortcut or feature fails: new tab, side panel, Orbit Bar?',
  ],
  'Privacy question': [
    'What you want to know: what is stored, what is sent, how to clear it.',
    'Which product: Mac app, extension or website.',
    'We answer from what the software actually does, and say so if we do not know.',
  ],
  'Feature request': [
    'The problem you want solved, not only the solution.',
    'How you work around it today.',
    'How often you would use it.',
  ],
  'Account or something else': [
    'Describe it plainly; we will route it.',
    'X Orbit has no accounts yet. Tell us what you were trying to do.',
  ],
}

export const CANNED = [
  [
    'Thanks for the report',
    'Thanks for reporting this. We are looking into it and will reply here as soon as we know more.',
  ],
  [
    'Need more detail',
    'Could you tell us a bit more? Which version of X Orbit are you using (Settings > About X Orbit), what system are you on, and what exact steps lead to this?',
  ],
  [
    'Mac "can\'t be opened"',
    'macOS blocks apps that are not signed with an Apple Developer ID yet. Open System Settings > Privacy & Security, scroll to the message about X Orbit and click Open Anyway. Only do this for the file downloaded from the official Download page.',
  ],
  [
    'Fixed - please confirm',
    'We believe this is fixed. Could you try again and tell us whether it works for you? If we do not hear back we will mark this ticket as solved.',
  ],
]
