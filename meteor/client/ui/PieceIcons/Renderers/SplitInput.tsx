import * as React from 'react'
import { Piece } from '../../../../lib/collections/Pieces'
import { SplitsContent, SourceLayerType } from 'tv-automation-sofie-blueprints-integration'

// @todo: use colours from the scss
// @todo: split can use any source (rather than cam + live)
export default class SplitInputIcon extends React.Component<{ abbreviation?: string, piece?: Piece }> {
	getCameraLabel (piece: Piece | undefined) {
		if (piece && piece.content) {
			let c = piece.content as SplitsContent
			const camera = c.boxSourceConfiguration.find(i => i.type === SourceLayerType.CAMERA)
			if (camera && camera.studioLabel) {
				const label = camera.studioLabel.match(/([a-zA-Z]+)?(\d+)/)
				return <React.Fragment>
							{label && label[1] ? label[1].substr(0, 1).toUpperCase() + ' ' : ''}
							<tspan style={{ 'fontFamily': 'Roboto', 'fontWeight': 'normal' }}>{ label ? label[2] : '' }</tspan>
						</React.Fragment>
			} else {
				return this.props.abbreviation ? this.props.abbreviation : 'Spl'
			}
		} else {
			return this.props.abbreviation ? this.props.abbreviation : 'Spl'
		}
	}

	getSourceType (type: SourceLayerType): string {
		switch (type) {
			case SourceLayerType.CAMERA:
				return 'camera'
			case SourceLayerType.REMOTE:
				return 'remote'
			case SourceLayerType.VT:
				return 'vt'
		}
		return ''
	}

	getLeftSourceType (piece: Piece | undefined): string {
		if (piece && piece.content) {
			let c = piece.content as SplitsContent
			const left = (c.boxSourceConfiguration[0] || {}).type || SourceLayerType.CAMERA
			return this.getSourceType(left)
		}
		return 'camera'
	}

	getRightSourceType (piece: Piece | undefined): string {
		if (piece && piece.content) {
			let c = piece.content as SplitsContent
			const right = (c.boxSourceConfiguration[1] || {}).type || SourceLayerType.REMOTE
			const sourceType = this.getSourceType(right)
			return sourceType + (this.getLeftSourceType(piece) === sourceType ? ' second' : '')
		}
		return 'remote'
	}

	render () {
		return (
			<svg className='piece_icon' version='1.1' viewBox='0 0 126.5 89' xmlns='http://www.w3.org/2000/svg'>
				<rect width='126.5' height='44.5' className={this.getLeftSourceType(this.props.piece)} />
				<rect width='126.5' height='44.5' y='44.5' className={this.getRightSourceType(this.props.piece)} />
				<text x='9.6414976' textLength='106.5' y='71.513954' textAnchor='middle' style={{ fill: '#ffffff', 'fontFamily': 'open-sans', 'fontSize': '40px', 'letterSpacing': '0px', 'lineHeight': '1.25', 'wordSpacing': '0px', 'textShadow': '0 2px 9px rgba(0, 0, 0, 0.5)' }} xmlSpace='preserve'>
					<tspan x='63.25' y='71.513954' textLength='106.5' lengthAdjust='spacingAndGlyphs' style={{ fill: '#ffffff', 'fontFamily': 'Roboto', 'fontSize': '75px', 'fontWeight': 100 }}>{
						this.getCameraLabel(this.props.piece)
					}</tspan>
				</text>
			</svg>
		)
	}
}
