<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useColorMode, useDebounceFn, useScroll } from '@vueuse/core'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { read } from "xlsx"
import { processFile } from './utils/utils'
import { Card, ScryfallCard } from './models/card'
import { FetchCardStatus, useFetchCards, useFetchSets } from './api/scryfall.api'
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
import { EyeIcon, EyeSlashIcon, FunnelIcon, XMarkIcon } from "@heroicons/vue/24/outline"

type ImportStep = "import" | "overall" | "set"

const mode = useColorMode({})
//mode.value = "dark"

const filterSearchText = ref('')

const currentStep = ref<ImportStep>("import")
const spreadsheetCards = ref<Card[]>([])

const importedCards = ref<Card[]>([])
const trackerStatus = ref<FetchCardStatus>({ progress: 0, text: "---" })
const cards = reactive(useFetchCards(importedCards, trackerStatus))
const sets = reactive(useFetchSets())

const collectedCards = ref<Set<string>>(new Set())
const cardsBySet = ref<Map<string, ScryfallCard[]>>(new Map())
const setsByKey = ref<Map<string, string>>(new Map())

const selectedSet = ref<string | undefined>()

const chartSeriesData = ref<number[]>([])
const chartSeriesLabels = ref<string[]>([])

const currentProgress = ref(50)
const progressStatus = ref("...")

const filterDialog = ref<HTMLDialogElement>()
const filterListElement = ref<HTMLElement>()
const filterListElementScroll = useScroll(filterListElement)
const filteredSetList = computed(() => {
  const setKeys = [...setsByKey.value.keys()]
  return setKeys.filter(sk => filterSearchText.value?.length === 0 || `${sk.toLowerCase()}: ${setsByKey.value.get(sk)!.toLowerCase()}`.indexOf(filterSearchText.value.toLowerCase()) >= 0).sort()
})

const hiddenSets = ref(new Set<string>())

const filteredListIsScrolling = computed(() => {
  return !(filterListElementScroll.arrivedState.top && filterListElementScroll.arrivedState.bottom)
})

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
    noData: {
      text: "No data to display"
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

const filterSearchUpdated = useDebounceFn((value: string) => {
  filterSearchText.value = value
})

const markAsCollected = (cardName: string) => {
  collectedCards.value.add(cardName)
}

const calculateSeriesData = () => {
  const data: number[] = []
  const labels: string[] = []
  const series: { data: number, label: string }[] = []

  for (let setKey of cardsBySet.value.keys()) {
    if (hiddenSets.value.has(setKey)) continue

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

const toggleSetVisibility = (setKey: string) => {
  if (hiddenSets.value.has(setKey)) {
    hiddenSets.value.delete(setKey)
  } else {
    hiddenSets.value.add(setKey)
  }
  calculateSeriesData()
}

const toggleAllSetVisibility = () => {
  if (hiddenSets.value.size > 0) {
    hiddenSets.value.clear()
  } else {
    hiddenSets.value = new Set(filteredSetList.value)
  }
  calculateSeriesData()
}

const getColourAsClass = (colour: string) => {
  const classObj: any = {}

  const className = `card-symbol-${colour.toLowerCase()}`
  classObj[className] = true

  return classObj
}

const showFilterDialog = () => {
  filterDialog.value?.showModal()
  filterListElementScroll.measure()
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

  watch(filteredSetList, async () => {
    await nextTick()
    filterListElementScroll.measure()
  })
})

const resetData = () => {
  delete localStorage["scryfall-query"]
  currentStep.value = 'import'
}

</script>

<template>
  <div class="flex-1 h-full flex flex-col items-center justify-center gap-1 p-6 overflow-hidden">
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
        <div class="flex flex-col flex-1 w-full items-center justify-center bg-gray-300 rounded-sm gap-2 p-4">
          <div class="text-4xl font-thin">Set Share</div>
          <div class="flex w-full justify-end pr-6">
            <Button variant="secondary" @click="showFilterDialog()" class="cursor-pointer">
              <EyeIcon class="h-5 w-5" />
            </Button>
          </div>
          <apexchart style="width: 100%; height:100%;" :options="chartOptions" :series="chartSeriesData">
          </apexchart>
        </div>
      </template>
      <template v-else-if="currentStep === 'set' && selectedSet">
        <div
          class="flex flex-col flex-1 w-full h-full items-center justify-center bg-gray-300 rounded-sm py-6 pl-6 gap-2">
          <div class="flex justify-between w-full">
            <Button variant="secondary" @click="backToOverall()">Back</Button>
            <div class="text-4xl font-thin flex-1 text-center flex justify-center items-center gap-2">
              <span class="p-2 rounded-full bg-primary border"><img class="w-6 h-6"
                  :src="sets.data?.get(selectedSet.toLowerCase())!.icon_svg_uri ?? ''" /></span>
              {{ selectedSet }}: {{ setsByKey.get(selectedSet)! }}
            </div>
            <div class="w-[61px]"></div> <!--For justify-->
          </div>
          <div class="flex-1 w-full overflow-auto pr-6">
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
              <TableBody class="flex-1 h-full w-full">
                <TableRow v-for="(card, cardIndex) in cardsBySet.get(selectedSet)">
                  <TableCell>{{ card.name }}</TableCell>
                  <TableCell class="flex basis-0">
                    <div class="flex gap-1 bg-black rounded-full p-1 pb-1.5">
                      <abbr v-for="colour in card.colors" class="card-symbol" :class="getColourAsClass(colour)" />
                      <abbr v-if="!card.colors.length" class="card-symbol card-symbol-c" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Popover v-if="card.urisBySet && card.urisBySet.has(selectedSet) !== undefined">
                      <PopoverTrigger>
                        <Button variant="secondary">View</Button>
                      </PopoverTrigger>
                      <PopoverContent class="bg-black">
                        <img v-if="card.urisBySet.get(selectedSet)!.large || card.urisBySet.get(selectedSet)!.normal"
                          :src="card.urisBySet.get(selectedSet)!.large ?? card.urisBySet.get(selectedSet)!.normal" />
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell>
                    <Button v-if="!collectedCards.has(card.name)" class="bg-green-600" @click="() => {
                      markAsCollected(card.name)
                    }">Add to Collection</Button>
                    <Button v-else variant="destructive" @click="() => {
                      collectedCards.delete(card.name)
                    }">Remove from Collection</Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </template>
    </template>
    <dialog closedby="any" id="visibility-dialog" ref="filterDialog"
      class="fixed w-[30em] top-[14em] justify-self-center rounded-md p-2 bg-primary border overflow-hidden">
      <div class="flex flex-col gap-1 min-w-0 min-h-0">
        <div class="relative w-full items-center">
          <Input class="pl-8 pr-8" :model-value="filterSearchText"
            @update:model-value="filterSearchUpdated($event.toString())" />
          <span class="absolute start-0 inset-y-0 flex items-center justify-center px-2">
            <FunnelIcon class="w-5 h-5" />
          </span>
          <span class="absolute end-0 inset-y-0 flex items-center justify-center px-2">
            <XMarkIcon class="w-5 h-5" @click="filterSearchUpdated('')" />
          </span>
        </div>
        <div class="flex justify-end pt-2"
          :class="{ 'pr-5': filteredListIsScrolling, 'pr-1': !filteredListIsScrolling }">
          <span class="p-1 rounded-full hover:bg-secondary hover:text-primary cursor-pointer">
            <EyeIcon v-if="hiddenSets.size > 0" class="h-5 w-5" @click="toggleAllSetVisibility()" />
            <EyeSlashIcon v-else class="h-5 w-5" @click="toggleAllSetVisibility()" />
          </span>
        </div>
        <div ref="filterListElement" class="overflow-y-auto flex-1 max-h-140">
          <div v-if="filteredSetList.length === 0" class="flex justify-center py-2">No data</div>
          <div v-for="set of filteredSetList"
            class="flex justify-between p-2 hover:bg-secondary hover:text-primary cursor-pointer rounded-sm"
            @click="toggleSetVisibility(set)">
            <span class="flex gap-1 items-center">
              <img class="w-4 h-4" :src="sets.data?.get(set.toLowerCase())!.icon_svg_uri ?? ''" />
              <span>{{ set }}: {{ setsByKey.get(set)! }}</span>
            </span>
            <EyeIcon v-if="!hiddenSets.has(set)" class="h-5 w-5" />
            <EyeSlashIcon v-else class="h-5 w-5" />
          </div>
        </div>
      </div>
    </dialog>
    <div class="fixed right-6 top-6">
      <Button class="cursor-pointer" variant="destructive" @click="resetData()">Reset Data</Button>
    </div>
  </div>
</template>
