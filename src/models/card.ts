export type Status = "N_A" | "NOT_OWNED" | "OWNED" | "UNCERTAIN"

export type ScryfallCard = {
  oracle_id: string
  name: string
  uri: string
  colors: string[]
  urisBySet: Map<string, {
    small: string
    normal: string
    large: string
  }>
}


export type MtgSet = {
  setName: string
  set: string
}

export type WrappedScryfallCard = {
  card: ScryfallCard
  sets: MtgSet[]
}

export type Card = {
  name: string
  status: Status
}