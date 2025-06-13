import { Card, JsonFriendlyWrappedScryfallCard, WrappedScryfallCard } from "@/models/card"
import { ScryfallSet } from "@/models/set"
import { sanitiseWrappedCard, serialiseWrappedCard } from "@/utils/utils"
import { useQuery } from "@tanstack/vue-query"
import { MaybeRefOrGetter } from "@tanstack/vue-query/build/legacy/types"
import axios from "axios"
import { Ref, toValue } from "vue"

export type FetchCardStatus = {
    progress: number
    text: string
}

export const useFetchSets = () => {
    return useQuery<Map<string, ScryfallSet>>({
        queryKey: ['sets'],
        queryFn: async () => {
            const { data } = await axios.get<{ data: ScryfallSet[] }>(`https://api.scryfall.com/sets`)

            const setMap = new Map<string, ScryfallSet>()

            data.data.forEach(s => setMap.set(s.code, s))

            return setMap
        },
        staleTime: Infinity
    })
}

export const useFetchCards = (cards: MaybeRefOrGetter<Card[]>, statusTracker: Ref<FetchCardStatus>) => {
    return useQuery<WrappedScryfallCard[]>({
        queryKey: ['cards', { cardNames: cards }],
        queryFn: async () => {
            let cardsArray = [...toValue(cards)]

            const queryStorage: { [index: string]: JsonFriendlyWrappedScryfallCard } = JSON.parse(localStorage["scryfall-query"] ?? "{}")

            const finalCards: WrappedScryfallCard[] = []

            // Fetch existing cards from the storage
            for (let i = 0; i < cardsArray.length; i++) {
                const card = cardsArray[i]
                if (!queryStorage[card.name]) continue

                finalCards.push(serialiseWrappedCard(queryStorage[card.name]))
            }

            for (let i = 0; i < cardsArray.length; i++) {
                const card = cardsArray[i]

                if (queryStorage[card.name]) {
                    continue
                }

                statusTracker.value.text = `[${finalCards.length}/${cardsArray.length}] ${card.name}`
                statusTracker.value.progress = Math.round(i / cardsArray.length * 100)

                const { data } = await axios.get<{ data: any[] }>(`https://api.scryfall.com/cards/search?q=!"${card.name}"&unique=prints`, { headers: { Accept: "application/json" } })

                const wrappedCard: WrappedScryfallCard = {
                    card: { ...data.data[0], urisBySet: new Map() },
                    sets: data.data.map(c => { return { setName: c.set_name, set: c.set.toUpperCase() } })
                }

                for (let card of data.data) {
                    if (wrappedCard.card.urisBySet.has(card.set.toUpperCase())) {
                        continue
                    }

                    wrappedCard.card.urisBySet.set(card.set.toUpperCase(), card.image_uris)
                }

                queryStorage[card.name] = sanitiseWrappedCard(wrappedCard)

                finalCards.push(wrappedCard)

                // Scryfall API requires 50-100ms between requests
                await new Promise(resolve => setTimeout(resolve, 100))
            }

            localStorage["scryfall-query"] = JSON.stringify(queryStorage)

            return finalCards
        },
        staleTime: Infinity
    })
}