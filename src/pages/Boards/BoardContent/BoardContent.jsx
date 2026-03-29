import Box from '@mui/material/Box'
import ListColumns from './ListColumns/ListColumns'
import { mapOrder } from '~/utils/sorts'

import {
  DndContext,
  // PointerSensor,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  DragOverlay,
  defaultDropAnimationSideEffects,
  closestCorners
} from '@dnd-kit/core'
import { useEffect, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { cloneDeep } from 'lodash'

import Column from './ListColumns/Column/Column'
import Card from './ListColumns/Column/ListCards/Card/Card'

const ACTIVE_DRAG_ITEM_TYPE = {
  COLUMN: 'ACTIVE_DRAG_ITEM_TYPE_COLUMN',
  CARD: 'ACTIVE_DRAG_ITEM_TYPE_CARD'
}

function BoardContent({ board }) {
  // const pointerSensor = useSensor( PointerSensor, { activationConstraint: { distance: 10 } })

  const mouseSensor = useSensor( MouseSensor, { activationConstraint: { distance: 10 } })

  const touchSensor = useSensor( TouchSensor, { activationConstraint: { delay: 250, tolerance: 500 } })

  // const sensors = useSensors(pointerSensor)
  const sensors = useSensors(mouseSensor, touchSensor)

  const [orderedColumns, setOrderedColumns] = useState([])
  // at the same time we can have 1 active drag item,
  // but we can use this state to know the type of active drag item is column or card,
  // because when we drag and drop we will have different logic for column and card
  const [activeDragItemId, setActiveDragItemId] = useState(null)
  const [activeDragItemType, setActiveDragItemType] = useState(null)
  const [activeDragItemData, setActiveDragItemData] = useState(null)
  const [oldColumnWhenDraggingCard, setOldColumnWhenDraggingCard] = useState(null)


  useEffect(() => {
    setOrderedColumns(mapOrder(board?.columns, board?.columnOrderIds, '_id'))
  }, [board])

  // Find Column By CardId
  const findColumnByCardId = (cardId) => {
    return orderedColumns.find(column => column?.cards.map(c => c._id)?.includes(cardId))
  }


  // Trigger when drag a element
  const handleDragStart = (event) => {
    // console.log('handleDragStart', event)
    setActiveDragItemId(event?.active?.id)
    setActiveDragItemType(event?.active?.data?.current?.columnId ? ACTIVE_DRAG_ITEM_TYPE.CARD :
      ACTIVE_DRAG_ITEM_TYPE.COLUMN)
    setActiveDragItemData(event?.active?.data?.current)


    // this will perfrom of action set value for oldColumn if we dragg card
    if (event?.active?.data?.current?.columnId) {
      setOldColumnWhenDraggingCard(findColumnByCardId(event?.active?.id))
    }
  }
  // console.log('activeDragItemType', activeDragItemType)

  const handleDragOver = (event) => {
    //Nothing to do when we drag column
    if (activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.COLUMN) return

    //If drag card we treat more to drag card over column
    const { active, over } = event

    // check if not exists over and active ( drag outside of area ) to a avoid crash web
    if (!active || !over) return

    //activeDraggingCardId is the card we are dragging
    const { id: activeDraggingCardId, data: { current: activeDraggingCardData } } = active
    //overCardId is the card we are dragging over, it can be null if we drag over column but not over any card
    const { id: overCardId } = over


    // Find 2 columns for cardId
    const activeColumn = findColumnByCardId(activeDraggingCardId)
    const overColumn = findColumnByCardId(overCardId)


    if (!activeColumn || !overColumn) return

    // we drag over other column , the logic will treat
    if (activeColumn._id !== overColumn._id) {
      // Handle card moved to another column
      setOrderedColumns(prevColumns => {
        // Find the index of the card in the end of column where we dragging
        const overCardIndex = overColumn?.cards?.findIndex(c => c._id === overCardId)
        // console.log('overCardIndex', overCardIndex)

        let newCardIndex
        const isBelowOverItem = active.rect.current.translated &&
          active.rect.current.translated.top > over.rect.top + over.rect.height
        const modifier = isBelowOverItem ? 1 : 0
        // console.log(overCardIndex)

        newCardIndex = overCardIndex >= 0 ? overCardIndex + modifier : overColumn?.cards.length + 1
        // console.log(newCardIndex)

        const nextColumns = cloneDeep(prevColumns)
        const nextActiveColumn = nextColumns.find(c => c._id === activeColumn._id)
        const nextOverColumn = nextColumns.find(c => c._id === overColumn._id)
        // console.log("active column", activeColumn._id)
        // console.log("over column", overColumn._id)
        // console.log('nextColumns', nextColumns)
        // console.log('nextActiveColumn', nextActiveColumn)
        // console.log('nextOverColumn', nextOverColumn)

        // old coulmn we need to delete card we are dragging
        if (nextActiveColumn) {
          // Delete card in old column ( when we drag card outside of column)
          nextActiveColumn.cards = nextActiveColumn.cards.filter(c => c._id !== activeDraggingCardId)
          //Update CardOrderIds for sync
          nextActiveColumn.cardOrderIds = nextActiveColumn.cards.map(c => c._id)
        }

        // new column
        if (nextOverColumn) {
          //Check if we drag card over other card , it exist  overColumn yet, if exist we need to delete it first
          nextOverColumn.cards = nextOverColumn.cards.filter(c => c._id !== activeDraggingCardId)
          //second we need to add card dragged in overColumn follow the index
          nextOverColumn.cards = nextOverColumn.cards.toSpliced(newCardIndex, 0, activeDraggingCardData)

          //Update CardOrderIds for sync
          nextOverColumn.cardOrderIds = nextOverColumn.cards.map(c => c._id)
        }

        return nextColumns
      })
    }
  }

  // Trigger when end action drop a element

  const handleDragEnd = (event) => {
    // console.log('handleDragEnd', event)
    const { active, over } = event

    if (!active || !over) return

    //treate drag and drop card
    if (activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.CARD) {
      //activeDraggingCardId is the card we are dragging
      const { id: activeDraggingCardId, data: { current: activeDraggingCardData } } = active
      //overCardId is the card we are dragging over, it can be null if we drag over column but not over any card
      const { id: overCardId } = over


      // Find 2 columns for cardId
      const activeColumn = findColumnByCardId(activeDraggingCardId)
      const overColumn = findColumnByCardId(overCardId)


      if (!activeColumn || !overColumn) return

      // we have to set state in drag start because when we drag the onDragOver updated state one
      if (oldColumnWhenDraggingCard._id !== overColumn._id) {
        //
      } else {
        // Action of dragging card same column

        //get old card index from oldColumnWhenDraggingCard
        const oldCardIndex = oldColumnWhenDraggingCard?.cards?.findIndex(c => c._id === activeDragItemId)
        //get new card index after we drag and drop in same column
        const newCardIndex = overColumn?.cards?.findIndex(c => c._id === overCardId)


        // Use ArrayMove beacuse drag card in same column  like logic drag column in board content
        const dndOrderedCards = arrayMove(oldColumnWhenDraggingCard?.cards, oldCardIndex, newCardIndex )

        setOrderedColumns(prevColumns => {
          const nextColumns = cloneDeep(prevColumns)

          //Find the column  that we dragging card
          const targetColumn = nextColumns.find(column => column._id === overColumn._id)

          // Update cards and cardOrderIds for column we drag card in the same column
          targetColumn.cards = dndOrderedCards
          targetColumn.cardOrderIds = dndOrderedCards.map(card => card._id)

          return nextColumns
        })

      }

    }

    //treate drag and drop column
    if (activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.COLUMN) {
      if ( active.id !== over.id) {
        console.log('handleDragEnd for COLUMN')
        const oldColumnIndex = orderedColumns.findIndex(c => c._id === active.id)
        const newColumnIndex = orderedColumns.findIndex(c => c._id === over.id)

        const dndOrderedColumns = arrayMove(orderedColumns, oldColumnIndex, newColumnIndex )

        //call API
        // const dndOrderedColumnsIds = dndOrderedColumns.map(c => c._id)
        setOrderedColumns(dndOrderedColumns)
      }

      setActiveDragItemId(null)
      setActiveDragItemType(null)
      setActiveDragItemData(null)
      setOldColumnWhenDraggingCard(null)
    }
  }

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } })
  }

  return (
    <DndContext
      sensors={sensors}
      // conflict of Card 01 image
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <Box sx={{
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#34495e' : '#1976d2'),
        width: '100%',
        height: (theme) => theme.trello.boardContentHeight,
        p: '10px 0'
      }}>
        <ListColumns columns={orderedColumns} />
        <DragOverlay dropAnimation={dropAnimation} >
          {!activeDragItemType && null}
          {(activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.COLUMN) && <Column column ={activeDragItemData} />}
          {(activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.CARD) && <Card card ={activeDragItemData} />}
        </DragOverlay>
      </Box>
    </DndContext>
  )
}

export default BoardContent