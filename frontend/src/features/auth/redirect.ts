export function safeDestination(value: string | null) {
  if (
    !value ||
    !/^\/(home|impact|profile|trips(?:\/[^/?#\\]+)?)(?:\?[^#\\]*)?$/.test(value)
  )
    return "/home";
  return value;
}
