import * as React from 'react'
import * as _ from 'underscore'
import * as ClassNames from 'classnames'
import { Meteor } from 'meteor/meteor'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { RundownAPI } from '../../../lib/api/rundown'

import { DefaultListItemRenderer } from './Renderers/DefaultLayerItemRenderer'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { mousetrapHelper } from '../../lib/mousetrapHelper'
import { RundownUtils } from '../../lib/rundown'
import { ISourceLayer, IOutputLayer, SourceLayerType, VTContent, LiveSpeakContent } from 'tv-automation-sofie-blueprints-integration'
import { AdLibPieceUi } from './AdLibPanel'
import { MediaObject } from '../../../lib/collections/MediaObjects'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Rundown } from '../../../lib/collections/Rundowns'
import { PubSub } from '../../../lib/api/pubsub'
import { PieceId } from '../../../lib/collections/Pieces'

export interface IAdLibListItem {
	_id: PieceId,
	name: string,
	status?: RundownAPI.PieceStatusCode
	hotkey?: string
	isHidden?: boolean
	invalid?: boolean
	floated?: boolean
}

export interface IDashboardButtonProps {
	adLibListItem: IAdLibListItem
	layer: ISourceLayer
	outputLayer?: IOutputLayer
	onToggleAdLib: (aSLine: IAdLibListItem, queue: boolean, context: any) => void
	playlist: RundownPlaylist
	mediaPreviewUrl?: string
	isOnAir?: boolean
	widthScale?: number
	heightScale?: number
}
export const DEFAULT_BUTTON_WIDTH = 6.40625
export const DEFAULT_BUTTON_HEIGHT = 5.625

interface IDashboardButtonTrackedProps {
	status: RundownAPI.PieceStatusCode | undefined
	metadata: MediaObject | null
}

export const DashboardPieceButton = translateWithTracker<IDashboardButtonProps, {}, IDashboardButtonTrackedProps>((props: IDashboardButtonProps) => {
	const piece = props.adLibListItem as any as AdLibPieceUi

	const { status, metadata } = checkPieceContentStatus(piece, props.layer, props.playlist.getStudio().settings)

	return {
		status,
		metadata
	}
})(class extends MeteorReactComponent<Translated<IDashboardButtonProps & IDashboardButtonTrackedProps>> {
	private objId: string

	constructor (props: IDashboardButtonProps) {
		super(props)
	}

	componentDidMount () {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
		})
	}

	componentDidUpdate () {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
		})
	}

	updateMediaObjectSubscription () {
		if (this.props.adLibListItem && this.props.layer) {
			const piece = this.props.adLibListItem as any as AdLibPieceUi
			let objId: string | undefined = undefined

			switch (this.props.layer.type) {
				case SourceLayerType.VT:
					objId = (piece.content as VTContent).fileName.toUpperCase()
					break
				case SourceLayerType.LIVE_SPEAK:
					objId = (piece.content as LiveSpeakContent).fileName.toUpperCase()
					break
			}

			if (objId && objId !== this.objId) {
				// if (this.mediaObjectSub) this.mediaObjectSub.stop()
				this.objId = objId
				this.subscribe(PubSub.mediaObjects, this.props.playlist.studioId, {
					mediaId: this.objId
				})
			}
		} else {
			console.error('One of the Piece\'s is invalid:', this.props.adLibListItem)
		}
	}

	getPreviewUrl = (): string | undefined => {
		const { metadata } = this.props
		if (this.props.mediaPreviewUrl && metadata) {
			if (metadata && metadata.previewPath && this.props.mediaPreviewUrl) {
				return this.props.mediaPreviewUrl + 'media/thumbnail/' + encodeURIComponent(metadata.mediaId)
			}
		}
		return undefined
	}

	renderVTLiveSpeak () {
		if (this.props.metadata) {
			const previewUrl = this.getPreviewUrl()
			const adLib = this.props.adLibListItem as AdLibPieceUi
			const adLibContent = adLib.content as VTContent
			return <React.Fragment>
				{previewUrl && <img src={previewUrl} className='dashboard-panel__panel__button__thumbnail' />}
				{adLibContent &&
					<span className='dashboard-panel__panel__button__sub-label'>
						{RundownUtils.formatDiffToTimecode((adLibContent).sourceDuration || 0, false, undefined, undefined, undefined, true)}
					</span>}
			</React.Fragment>
		}
	}

	render () {
		return (
			<div className={ClassNames('dashboard-panel__panel__button', {
				'invalid': this.props.adLibListItem.invalid,
				'floated': this.props.adLibListItem.floated,

				'source-missing': this.props.status === RundownAPI.PieceStatusCode.SOURCE_MISSING,
				'source-broken': this.props.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN,
				'unknown-state': this.props.status === RundownAPI.PieceStatusCode.UNKNOWN,

				'live': this.props.isOnAir
			}, this.props.layer && RundownUtils.getSourceLayerClassName(this.props.layer.type))}
				style={{
					width: this.props.widthScale ?
						(this.props.widthScale * DEFAULT_BUTTON_WIDTH) + 'em' :
						undefined,
					height: this.props.heightScale ?
						(this.props.heightScale * DEFAULT_BUTTON_HEIGHT) + 'em' :
						undefined
				}}
				onClick={(e) => this.props.onToggleAdLib(this.props.adLibListItem, e.shiftKey, e)}
				data-obj-id={this.props.adLibListItem._id}
				>
				{
					this.props.layer && (this.props.layer.type === SourceLayerType.VT || this.props.layer.type === SourceLayerType.LIVE_SPEAK || true) ?
						this.renderVTLiveSpeak() :
						null
				}
				<span className='dashboard-panel__panel__button__label'>{this.props.adLibListItem.name}</span>
			</div>
		)
	}
})
