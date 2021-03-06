import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { ExpectedMediaItems, ExpectedMediaItem, ExpectedMediaItemId } from '../../lib/collections/ExpectedMediaItems'
import { Rundowns, RundownId } from '../../lib/collections/Rundowns'
import { Pieces, PieceGeneric } from '../../lib/collections/Pieces'
import { AdLibPieces } from '../../lib/collections/AdLibPieces'
import { syncFunctionIgnore } from '../codeControl'
import { saveIntoDb, getCurrentTime, getHash, protectString } from '../../lib/lib'
import { Parts, PartId } from '../../lib/collections/Parts'
import { Random } from 'meteor/random'
import { logger } from '../logging'
import { StudioId } from '../../lib/collections/Studios'

export enum PieceType {
	PIECE = 'piece',
	ADLIB = 'adlib'
}

// TODO-PartInstance generate these for when the part has no need, but the instance still references something

function generateExpectedMediaItems (rundownId: RundownId, studioId: StudioId, piece: PieceGeneric, pieceType: string): ExpectedMediaItem[] {
	const result: ExpectedMediaItem[] = []

	if (piece.content && piece.content.fileName && piece.content.path && piece.content.mediaFlowIds && piece.partId) {
		const partId = piece.partId;
		(piece.content.mediaFlowIds as string[]).forEach(function (flow) {
			const id = protectString<ExpectedMediaItemId>(getHash(pieceType + '_' + piece._id + '_' + flow + '_' + rundownId + '_' + piece.partId))
			result.push({
				_id: id,
				label: piece.name,
				disabled: false,
				lastSeen: getCurrentTime(),
				mediaFlowId: flow,
				path: this[0].toString(),
				url: this[1].toString(),

				rundownId: rundownId,
				partId: partId,
				studioId: studioId
			})
		}, [piece.content.fileName, piece.content.path])
	}

	return result
}

export const updateExpectedMediaItemsOnRundown: (rundownId: RundownId) => void
= syncFunctionIgnore(function updateExpectedMediaItemsOnRundown (rundownId: RundownId) {
	check(rundownId, String)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) {
		const removedItems = ExpectedMediaItems.remove({
			rundownId: rundownId
		})
		logger.info(`Removed ${removedItems} expected media items for deleted rundown "${rundownId}"`)
		return
	}
	const studioId = rundown.studioId

	const pieces = Pieces.find({
		rundownId: rundown._id
	}).fetch()
	const adlibs = AdLibPieces.find({
		rundownId: rundown._id
	}).fetch()

	const eMIs: ExpectedMediaItem[] = []

	function iterateOnPieceLike (piece: PieceGeneric, pieceType: string) {
		eMIs.push(...generateExpectedMediaItems(rundownId, studioId, piece, pieceType))
	}

	pieces.forEach((doc) => iterateOnPieceLike(doc, PieceType.PIECE))
	adlibs.forEach((doc) => iterateOnPieceLike(doc, PieceType.ADLIB))

	saveIntoDb<ExpectedMediaItem, ExpectedMediaItem>(ExpectedMediaItems, {
		rundownId: rundown._id
	}, eMIs)
})

export const updateExpectedMediaItemsOnPart: (rundownId: RundownId, partId: PartId) => void
= syncFunctionIgnore(function updateExpectedMediaItemsOnPart (rundownId: RundownId, partId: PartId) {
	check(rundownId, String)
	check(partId, String)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) {
		const removedItems = ExpectedMediaItems.remove({
			rundownId: rundownId
		})
		logger.info(`Removed ${removedItems} expected media items for deleted rundown "${rundownId}"`)
		return
	}
	const studioId = rundown.studioId

	const part = Parts.findOne(partId)
	if (!part) {
		const removedItems = ExpectedMediaItems.remove({
			rundownId: rundownId,
			partId: partId
		})
		logger.info(`Removed ${removedItems} expected media items for deleted part "${partId}"`)
		return
	}

	const eMIs: ExpectedMediaItem[] = []

	const pieces = Pieces.find({
		rundownId: rundown._id,
		partId: part._id
	}).fetch()
	const adlibs = AdLibPieces.find({
		rundownId: rundown._id,
		partId: part._id
	}).fetch()

	function iterateOnPieceLike (piece: PieceGeneric, pieceType: string) {
		eMIs.push(...generateExpectedMediaItems(rundownId, studioId, piece, pieceType))
	}

	pieces.forEach((doc) => iterateOnPieceLike(doc, PieceType.PIECE))
	adlibs.forEach((doc) => iterateOnPieceLike(doc, PieceType.ADLIB))

	saveIntoDb<ExpectedMediaItem, ExpectedMediaItem>(ExpectedMediaItems, {
		rundownId: rundown._id,
		partId: part._id
	}, eMIs)
})
