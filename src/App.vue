<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useColorMode } from '@vueuse/core'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { read } from "xlsx"
import { processFile } from './utils/utils'
import { Card, ScryfallCard, MtgSet, WrappedScryfallCard } from './models/card'
import { FetchCardStatus, useFetchCards } from './api/scryfall.api'
import { ApexOptions } from 'apexcharts'
import Table from './components/ui/table/Table.vue'
import TableCaption from './components/ui/table/TableCaption.vue'
import Button from './components/ui/button/Button.vue'
import TableHeader from './components/ui/table/TableHeader.vue'
import TableRow from './components/ui/table/TableRow.vue'
import TableHead from './components/ui/table/TableHead.vue'
import TableBody from './components/ui/table/TableBody.vue'
import TableCell from './components/ui/table/TableCell.vue'
import Popover from './components/ui/popover/Popover.vue'
import PopoverTrigger from './components/ui/popover/PopoverTrigger.vue'
import PopoverContent from './components/ui/popover/PopoverContent.vue'
import Progress from './components/ui/progress/Progress.vue'

type ImportStep = "import" | "overall" | "set"

const mode = useColorMode({})
mode.value = "dark"

const currentStep = ref<ImportStep>("import")
const spreadsheetCards = ref<Card[]>([])

const importedCards = ref<Card[]>([])
const trackerStatus = ref<FetchCardStatus>({ progress: 0, text: "---" })
const cards = reactive(useFetchCards(importedCards, trackerStatus))

const collectedCards = ref<Set<string>>(new Set())
const cardsBySet = ref<Map<string, ScryfallCard[]>>(new Map())
const setsByKey = ref<Map<string, string>>(new Map())

const selectedSet = ref<string | undefined>()

const chartSeriesData = ref<number[]>([])
const chartSeriesLabels = ref<string[]>([])

const currentProgress = ref(50)
const progressStatus = ref("...")

const chartClicked = (event: any, context: any, opts: { dataPointIndex: string }) => {
  const selectedDataPointIndex = parseInt(opts.dataPointIndex)
  selectSet(chartSeriesLabels.value[selectedDataPointIndex].split(":")[0])
}

const chartOptions = computed<ApexOptions>(() => {
  const options: ApexOptions = {
    chart: {
      type: "donut",
      events: {
        click: chartClicked
      }
    },
    plotOptions: {
      pie: {
        donut: {
          labels: {
            show: true,
            total: {
              showAlways: true,
              show: true
            }
          }
        }
      },
    },
    labels: chartSeriesLabels.value,
  }

  return options
})

const inputUpdated = async (event: any) => {
  const file = await event.currentTarget.files[0].arrayBuffer()
  const workbook = read(file)
  spreadsheetCards.value = processFile(workbook)
  for (let card of spreadsheetCards.value) {
    if (card.status === "OWNED" || card.status === "UNCERTAIN") {
      collectedCards.value.add(card.name)
    }
  }
  importedCards.value = spreadsheetCards.value
  currentStep.value = "overall"
}

const markAsCollected = (cardName: string) => {
  collectedCards.value.add(cardName)
}

const calculateSeriesData = () => {
  const data: number[] = []
  const labels: string[] = []
  const series: { data: number, label: string }[] = []

  for (let setKey of cardsBySet.value.keys()) {
    const uncollectedCards = cardsBySet.value.get(setKey)?.filter(c => !collectedCards.value.has(c.name))
    if (!uncollectedCards?.length) continue

    series.push({ label: `${setKey}: ${setsByKey.value.get(setKey)}`, data: uncollectedCards.length })
  }

  series.sort((a, b) => {
    return b.data - a.data
  })

  chartSeriesData.value = series.map(s => s.data)
  chartSeriesLabels.value = series.map(s => s.label)
}

const backToOverall = () => {
  currentStep.value = "overall"
  selectedSet.value = undefined
}

const selectSet = (setKey: string) => {
  selectedSet.value = setKey
  currentStep.value = "set"
}

onMounted(() => {
  watch(cards, () => {
    if (!cards.data?.length) {
      cardsBySet.value = new Map()
      return
    }

    const bySet = new Map<string, ScryfallCard[]>()

    for (let card of cards.data) {
      for (let set of card.sets) {
        if (bySet.get(set.set)?.find(c => c.name === card.card.name)) {
          // Have already added the card to this set, probably a print variant
          continue
        }

        if (!setsByKey.value.has(set.set)) {
          setsByKey.value.set(set.set, set.setName)
        }

        if (!bySet.has(set.set)) {
          bySet.set(set.set, [])
        }

        bySet.get(set.set)?.push(card.card)
      }
    }

    cardsBySet.value = bySet

    calculateSeriesData()
  })

  watch(collectedCards, () => {
    calculateSeriesData()
  }, { immediate: true })
})

const getColourAsClass = (colour: string) => {
  const classObj: any = {}

  const className = `card-symbol-${colour.toLowerCase()}`
  classObj[className] = true

  return classObj
}

</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center gap-1">
    <template v-if="cards.isFetching">
      <div class="flex flex-col items-center justify-center bg-black rounded-sm p-6 gap-2 w-[50%]">
        <Progress :model-value="trackerStatus.progress"></Progress>
        <div class="text-muted-foreground">{{ trackerStatus.text }}</div>
      </div>
    </template>
    <template v-else>
      <template v-if="currentStep === 'import'">
        <div class="flex flex-col items-center justify-center bg-gray-300 rounded-sm p-6 gap-2">
          <div class="grid w-full max-w-sm items-center gap-1.5">
            <Label for="xl-file">Load your file:</Label>
            <Input id="xl-file" type="file" @input="(event: any) => { inputUpdated(event) }" />
          </div>
        </div>
      </template>
      <template v-else-if="currentStep === 'overall'">
        <div class="flex flex-col flex-1 w-full h-full items-center justify-center bg-gray-300 rounded-sm p-6 gap-2">
          <div class="text-4xl font-thin">Set Share</div>
          <apexchart style="width: 100%; height:100%;" :options="chartOptions" :series="chartSeriesData">
          </apexchart>
        </div>
      </template>
      <template v-else-if="currentStep === 'set' && selectedSet">
        <div class="flex flex-col flex-1 w-full h-full items-center justify-center bg-gray-300 rounded-sm p-6 gap-2">
          <div class="flex justify-between flex-1 w-full">
            <Button variant="secondary" @click="backToOverall()">Back</Button>
            <div class="text-4xl font-thin flex-1 text-center">Cards to Collect</div>
            <div class="w-[61px]"></div> <!--For justify-->
          </div>
          <Table>
            <TableCaption>List of cards in set</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Card Name</TableHead>
                <TableHead>Colours</TableHead>
                <TableHead>View Card</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(card, cardIndex) in cardsBySet.get(selectedSet)">
                <TableCell>{{ card.name }}</TableCell>
                <TableCell class="flex basis-0">
                  <div class="flex gap-1 bg-black rounded-full p-1 pb-1.5">
                    <abbr v-for="colour in card.colors" class="card-symbol" :class="getColourAsClass(colour)" />
                  </div>
                </TableCell>
                <TableCell>
                  <Popover>
                    <PopoverTrigger>
                      <Button variant="secondary">View</Button>
                    </PopoverTrigger>
                    <PopoverContent class="bg-black">
                      <img :src="card.urisBySet.get(selectedSet)!.large" />
                    </PopoverContent>
                  </Popover>
                </TableCell>
                <TableCell>
                  <Button v-if="!collectedCards.has(card.name)" variant="secondary" @click="() => {
                    markAsCollected(card.name)
                  }">Add to Collection</Button>
                  <Button v-else variant="secondary" @click="() => {
                    collectedCards.delete(card.name)
                  }">Remove from Collection</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </template>
    </template>
  </div>
</template>
