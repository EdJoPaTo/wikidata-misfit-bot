export function getButtonsAsRows<T>(buttons: readonly T[], columns: number): T[][] {
	const totalRows = Math.ceil(buttons.length / columns)
	const rows: T[][] = []
	for (let i = 0; i < totalRows; i++) {
		const slice = buttons.slice(i * columns, (i + 1) * columns)
		rows.push(slice)
	}

	return rows
}
