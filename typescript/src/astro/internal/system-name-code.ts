/** Pack the four numeric boxel-name fields into their base-26 index. */
export function packBoxelCode(l1: number, l2: number, l3: number, n1: number): number {
    return ((n1 * 26 + l3) * 26 + l2) * 26 + l1;
}
