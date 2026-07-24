// A hint, not a gate — recording wants a phone (GPS, walking with a screen).
// Note iPads report a Mac user-agent these days, so they count as computers.
export function isMobileUA(ua: string): boolean {
  return /Mobi|Android|iPhone|iPad/i.test(ua);
}
