import { MtgSet } from "./set"

export type Status = "N_A" | "NOT_OWNED" | "OWNED" | "UNCERTAIN"

export type CardUris = {
  small: string
  normal: string
  large: string
}

type ScryfallCardBase = {
  oracle_id: string
  name: string
  uri: string
  colors: string[]
}

export type ScryfallCard = ScryfallCardBase & {
  urisBySet: Map<string, CardUris>
}

export type JsonFriendlyScryfallCard = ScryfallCardBase & {
  urisBySet: { [index: string]: CardUris }
}

export type WrappedScryfallCard = {
  card: ScryfallCard
  sets: MtgSet[]
}

export type JsonFriendlyWrappedScryfallCard = {
  card: JsonFriendlyScryfallCard
  sets: MtgSet[]
}

export type Card = {
  name: string
  status: Status
}