/** Minor units (paise) to a display price: whole amounts without decimals ("₹1,180"), others with two. */
export function money(minor: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100)
}
