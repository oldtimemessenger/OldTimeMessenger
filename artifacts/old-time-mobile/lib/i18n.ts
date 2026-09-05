export type TranslationKey =
  | 'updates'
  | 'pace'
  | 'map'
  | 'chat'
  | 'calls'
  | 'settings'
  | 'contacts'
  | 'recent'
  | 'noContacts'
  | 'noContactsDescription'
  | 'loadingContacts'
  | 'contactsLoadError'
  | 'tapToRetry'
  | 'outgoing'
  | 'incoming'
  | 'missed'
  | 'myProfile'
  | 'savedMessages'
  | 'recentCalls'
  | 'chatSettings'
  | 'notificationsSounds'
  | 'privacySecurity'
  | 'dataStorage'
  | 'appearance'
  | 'powerSaving'
  | 'language'
  | 'faq'
  | 'logout';

const translations: Record<string, Partial<Record<TranslationKey, string>>> = {
  English: {
    updates: 'Updates',
    pace: 'Pace',
    map: 'Map',
    chat: 'Chat',
    calls: 'Calls',
    settings: 'Settings',
    contacts: 'Contacts',
    recent: 'Recent',
    noContacts: 'No contacts yet',
    noContactsDescription: 'Other Old Time users will appear here when they are available.',
    loadingContacts: 'Loading contacts…',
    contactsLoadError: 'Contacts could not load.',
    tapToRetry: 'Tap to retry.',
    outgoing: 'Outgoing',
    incoming: 'Incoming',
    missed: 'Missed',
    myProfile: 'My Profile',
    savedMessages: 'Saved Messages',
    recentCalls: 'Recent Calls',
    chatSettings: 'Chat Settings',
    notificationsSounds: 'Notifications and Sounds',
    privacySecurity: 'Privacy and Security',
    dataStorage: 'Data and Storage',
    appearance: 'Appearance',
    powerSaving: 'Power Saving',
    language: 'Language',
    faq: 'Old Time FAQ',
    logout: 'Log Out',
  },
  'Haitian Creole': {
    updates: 'Mizajou',
    pace: 'Pase',
    map: 'Kat',
    chat: 'Chat',
    calls: 'Apèl',
    settings: 'Paramèt',
    contacts: 'Kontak',
    recent: 'Dènye apèl',
    noContacts: 'Pa gen kontak ankò',
    noContactsDescription: 'Lòt itilizatè Old Time ap parèt isit la lè yo disponib.',
    loadingContacts: 'Kontak yo ap chaje…',
    contactsLoadError: 'Kontak yo pa t kapab chaje.',
    tapToRetry: 'Peze pou eseye ankò.',
    outgoing: 'Sòti',
    incoming: 'Antre',
    missed: 'Rate',
    myProfile: 'Pwofil mwen',
    savedMessages: 'Mesaj sove',
    recentCalls: 'Dènye apèl',
    chatSettings: 'Paramèt chat',
    notificationsSounds: 'Notifikasyon ak son',
    privacySecurity: 'Konfidansyalite ak sekirite',
    dataStorage: 'Done ak depo',
    appearance: 'Aparans',
    powerSaving: 'Ekonomi batri',
    language: 'Lang',
    faq: 'FAQ Old Time',
    logout: 'Dekonekte',
  },
  French: {
    updates: 'Actualités',
    pace: 'Pace',
    map: 'Carte',
    chat: 'Discussions',
    calls: 'Appels',
    settings: 'Réglages',
    contacts: 'Contacts',
    recent: 'Récents',
    noContacts: 'Aucun contact',
    noContactsDescription: 'Les autres utilisateurs Old Time apparaîtront ici lorsqu’ils seront disponibles.',
    loadingContacts: 'Chargement des contacts…',
    contactsLoadError: 'Impossible de charger les contacts.',
    tapToRetry: 'Touchez pour réessayer.',
    outgoing: 'Sortant',
    incoming: 'Entrant',
    missed: 'Manqué',
    myProfile: 'Mon profil',
    savedMessages: 'Messages enregistrés',
    recentCalls: 'Appels récents',
    chatSettings: 'Réglages des discussions',
    notificationsSounds: 'Notifications et sons',
    privacySecurity: 'Confidentialité et sécurité',
    dataStorage: 'Données et stockage',
    appearance: 'Apparence',
    powerSaving: 'Économie d’énergie',
    language: 'Langue',
    faq: 'FAQ Old Time',
    logout: 'Se déconnecter',
  },
};

export function t(language: string, key: TranslationKey): string {
  return translations[language]?.[key] ?? translations.English[key] ?? key;
}