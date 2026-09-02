const MINIMUM_AGE_YEARS = 13;

export function isValidBirthday(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day) &&
    date.getTime() <= Date.now()
  );
}

export function meetsMinimumAge(value: string): boolean {
  if (!isValidBirthday(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const today = new Date();
  let age = today.getUTCFullYear() - year;
  const birthdayThisYear = new Date(Date.UTC(today.getUTCFullYear(), month - 1, day));
  if (birthdayThisYear.getTime() > today.getTime()) age -= 1;
  return age >= MINIMUM_AGE_YEARS;
}