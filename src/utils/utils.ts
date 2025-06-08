import { Card, Status } from "@/models/card"
import { CellObject, WorkBook } from "xlsx"

export const processFile = (workbook: WorkBook) => {
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]

    const orderedKeys = Object.keys(worksheet).sort((keyA: string, keyB: string) => {
        if (keyA.startsWith("!")) return -1
        if (keyB.startsWith("!")) return 1

        const regex = /([A-Z]{1,})(\d{1,})/
        const matchA = regex.exec(keyA)
        if (matchA == null) return -1

        const matchB = regex.exec(keyB)
        if (matchB == null) return 1

        const columnA = matchA[1]
        const rowA = parseInt(matchA[2])

        const columnB = matchB[1]
        const rowB = parseInt(matchB[2])


        return rowA - rowB === 0
            ? columnA.localeCompare(columnB)
            : rowA - rowB
    })

    const rows: { key: string, obj: CellObject }[][] = []
    let currentRow: number | undefined = undefined
    let rowOffset = 0

    orderedKeys.forEach(key => {
        if (key.startsWith("!")) return

        const regex = /([A-Z]{1,})(\d{1,})/
        const match = regex.exec(key)
        if (match == null) return

        const column = match[1]
        const row = parseInt(match[2])

        if (currentRow === undefined) {
            rowOffset = row
        }

        if (currentRow === undefined || currentRow !== row) {
            rows.push([])
            currentRow = row
        }

        rows[currentRow - rowOffset].push({ key, obj: { ...worksheet[key], h: worksheet[key].h ?? '' } as CellObject })
    })

    const cards: Card[] = []

    rows.forEach((row, rowIndex) => {
        const item: Card = {
            name: '',
            status: 'NOT_OWNED'
        }

        row.forEach((cell, cellIndex) => {
            if (rowIndex === 0) {
                // First row indicates table title
            } else if (rows[0][cellIndex].obj.v! === "Name") {
                item.name = cell.obj.v?.toString() ?? ""
            } else if (rows[0][cellIndex].obj.v! === "Status") {
                item.status = cell.obj.v?.toString() as Status ?? "NOT_OWNED"
            }
        })

        if (rowIndex !== 0) {
            cards.push(item)
        }
    })

    return cards
}