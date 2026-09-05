export type StickerLocale = 'en' | 'es' | 'fr' | 'ht' | 'pt';

export type ChatSticker = {
  id: string;
  emoji: string;
  text: string;
  group: 'quick' | 'seasonal' | 'local';
};

type StickerCopy = {
  hello: string; goodMorning: string; goodEvening: string; happyWeekend: string; thinkingOfYou: string; from: string;
  laborDay: string; newYear: string; valentines: string; mothersDay: string; fathersDay: string;
  halloween: string; thanksgiving: string; christmas: string;
};

const copy: Record<StickerLocale, StickerCopy> = {
  en: { hello: 'Hello!', goodMorning: 'Good morning!', goodEvening: 'Good evening!', happyWeekend: 'Happy weekend!', thinkingOfYou: 'Thinking of you', from: 'Hello from', laborDay: 'Happy Labor Day!', newYear: 'Happy New Year!', valentines: 'Happy Valentine’s Day!', mothersDay: 'Happy Mother’s Day!', fathersDay: 'Happy Father’s Day!', halloween: 'Happy Halloween!', thanksgiving: 'Happy Thanksgiving!', christmas: 'Merry Christmas!' },
  es: { hello: '¡Hola!', goodMorning: '¡Buenos días!', goodEvening: '¡Buenas noches!', happyWeekend: '¡Feliz fin de semana!', thinkingOfYou: 'Estoy pensando en ti', from: 'Saludos desde', laborDay: '¡Feliz Día del Trabajo!', newYear: '¡Feliz Año Nuevo!', valentines: '¡Feliz San Valentín!', mothersDay: '¡Feliz Día de la Madre!', fathersDay: '¡Feliz Día del Padre!', halloween: '¡Feliz Halloween!', thanksgiving: '¡Feliz Día de Acción de Gracias!', christmas: '¡Feliz Navidad!' },
  fr: { hello: 'Bonjour !', goodMorning: 'Bonjour !', goodEvening: 'Bonsoir !', happyWeekend: 'Bon week-end !', thinkingOfYou: 'Je pense à toi', from: 'Bonjour depuis', laborDay: 'Bonne fête du Travail !', newYear: 'Bonne année !', valentines: 'Bonne Saint-Valentin !', mothersDay: 'Bonne fête des Mères !', fathersDay: 'Bonne fête des Pères !', halloween: 'Joyeux Halloween !', thanksgiving: 'Joyeux Thanksgiving !', christmas: 'Joyeux Noël !' },
  ht: { hello: 'Bonjou!', goodMorning: 'Bonjou!', goodEvening: 'Bonswa!', happyWeekend: 'Bon wikenn!', thinkingOfYou: 'M ap panse avè w', from: 'Bonjou depi', laborDay: 'Bòn fèt Travay!', newYear: 'Bòn ane!', valentines: 'Bòn fèt Sen Valanten!', mothersDay: 'Bòn fèt Manman!', fathersDay: 'Bòn fèt Papa!', halloween: 'Bòn fèt Halloween!', thanksgiving: 'Bòn fèt Aksyon de Gras!', christmas: 'Jwaye Nwèl!' },
  pt: { hello: 'Olá!', goodMorning: 'Bom dia!', goodEvening: 'Boa noite!', happyWeekend: 'Feliz fim de semana!', thinkingOfYou: 'Estou pensando em você', from: 'Olá de', laborDay: 'Feliz Dia do Trabalho!', newYear: 'Feliz Ano Novo!', valentines: 'Feliz Dia dos Namorados!', mothersDay: 'Feliz Dia das Mães!', fathersDay: 'Feliz Dia dos Pais!', halloween: 'Feliz Halloween!', thanksgiving: 'Feliz Dia de Ação de Graças!', christmas: 'Feliz Natal!' },
} as const;

export function stickerLocale(locale?: string): StickerLocale {
  const language = (locale ?? Intl.DateTimeFormat().resolvedOptions().locale).toLowerCase().split('-')[0];
  if (language === 'es' || language === 'fr' || language === 'ht' || language === 'pt') return language;
  return 'en';
}

function nthWeekday(year: number, month: number, weekday: number, occurrence: number) {
  const first = new Date(year, month, 1);
  return 1 + ((7 + weekday - first.getDay()) % 7) + ((occurrence - 1) * 7);
}

function seasonalSticker(date: Date, words: StickerCopy) {
  const month = date.getMonth();
  const day = date.getDate();
  const year = date.getFullYear();
  const within = (targetMonth: number, targetDay: number, range = 2) => month === targetMonth && Math.abs(day - targetDay) <= range;
  if (within(0, 1, 3)) return { id: 'new-year', emoji: '🎆', text: words.newYear };
  if (within(1, 14)) return { id: 'valentines', emoji: '❤️', text: words.valentines };
  if (month === 4 && Math.abs(day - nthWeekday(year, 4, 0, 2)) <= 2) return { id: 'mothers-day', emoji: '💐', text: words.mothersDay };
  if (month === 5 && Math.abs(day - nthWeekday(year, 5, 0, 3)) <= 2) return { id: 'fathers-day', emoji: '👔', text: words.fathersDay };
  if (month === 8 && Math.abs(day - nthWeekday(year, 8, 1, 1)) <= 3) return { id: 'labor-day', emoji: '🇺🇸', text: words.laborDay };
  if (within(9, 31, 3)) return { id: 'halloween', emoji: '🎃', text: words.halloween };
  if (month === 10 && Math.abs(day - nthWeekday(year, 10, 4, 4)) <= 3) return { id: 'thanksgiving', emoji: '🦃', text: words.thanksgiving };
  if (within(11, 25, 4)) return { id: 'christmas', emoji: '🎄', text: words.christmas };
  return null;
}

function localeRegionLabel(locale?: string) {
  const resolved = locale ?? Intl.DateTimeFormat().resolvedOptions().locale;
  const region = resolved.match(/[-_]([A-Z]{2}|\d{3})(?:[-_]|$)/i)?.[1]?.toUpperCase();
  if (!region) return null;
  try {
    return new Intl.DisplayNames([resolved], { type: 'region' }).of(region) ?? region;
  } catch {
    return region;
  }
}

/** Suggestions use device language, calendar, and locale region without forcing a location permission prompt. */
export function getChatStickerSuggestions(input?: { locale?: string; recipientLocale?: string; locationLabel?: string; now?: Date }): ChatSticker[] {
  const resolvedLocale = input?.recipientLocale ?? input?.locale ?? Intl.DateTimeFormat().resolvedOptions().locale;
  const locale = stickerLocale(resolvedLocale);
  const words = copy[locale];
  const date = input?.now ?? new Date();
  const hour = date.getHours();
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const greeting = hour < 12 ? { emoji: '☀️', text: words.goodMorning } : hour >= 18 ? { emoji: '🌙', text: words.goodEvening } : { emoji: '👋', text: words.hello };
  const seasonal = seasonalSticker(date, words);
  const place = input?.locationLabel ?? localeRegionLabel(resolvedLocale);
  return [
    { id: 'love', emoji: '❤️', text: '❤️', group: 'quick' },
    { id: 'laugh', emoji: '😂', text: '😂', group: 'quick' },
    { id: 'thumbs-up', emoji: '👍', text: '👍', group: 'quick' },
    { id: 'thanks', emoji: '🙏', text: '🙏', group: 'quick' },
    { id: 'greeting', ...greeting, group: 'seasonal' },
    ...(seasonal ? [{ ...seasonal, group: 'seasonal' as const }] : []),
    { id: weekend ? 'weekend' : 'thinking', emoji: weekend ? '🎉' : '💭', text: weekend ? words.happyWeekend : words.thinkingOfYou, group: 'seasonal' },
    ...(place ? [{ id: 'local', emoji: '📍', text: `${words.from} ${place}`, group: 'local' as const }] : []),
  ];
}