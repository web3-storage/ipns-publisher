
export function shorten (str) {
  return `${str.slice(0, 6)}..${str.slice(-6)}`
}
