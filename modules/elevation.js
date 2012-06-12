/*
 *
 *	Map module for adding terrain elevation.
 *
 *  All modules add themselves to the Polygons namespace.
 *
 */
 
define(['modules/oceans'], function () {
	var ElevationStep = 10,
		CoastElevation = 0;
	var colors = [
		'#6a965c',
		'#85a979',
		'#9cb993',
		'#c7d8c2',
		'#e0e9de',
		'#fbfcfb'
	];
	return {
		// @private
		_initCoasts: function (processing, seen) {
			iter(Polygons.corners, function (i, corner) {
				if (corner.coast) {
					processing.push(corner);
					seen[corner.id] = 1;
					corner.elevation = CoastElevation;
				}
			});
		},
		// Generate elevation as the distance from the coast
		// If we are not using the Oceans module, then define 
		// random subsections as low ground, and start from there
		
		// TODO: Clean this method up
		generate: function (stepSize) {
			var corners = Polygons.corners,
				polygons = Polygons.centers,
				context = Polygons.context,
				processing = [],
				seen = {};
			ElevationStep = stepSize || 10;
			if (Polygons.hasModule('oceans')) {
				// Mark the coasts initially, and move outward from there
				// By default, coasts are at elevation 0 (sea level)
				this._initCoasts(processing, seen);
				
				while (processing.length > 0) {
					var next = processing.shift();
					iter(next.polygons, function (i, polygon) {
						// Rolling average
						polygon.elevation = ((polygon.elevation  || 0) + next.elevation) / 2;
					});
					iter(next.adjacent, function (i, corner) {
						if (!seen[corner.id]) {
							processing.push(corner);
							seen[corner.id] = 1;
							corner.elevation = next.elevation + (corner.ocean ? -ElevationStep : ElevationStep);
						}
					});
				}
				
				iter(Polygons.centers, function (i, polygon) {
					if (!polygon.ocean) {
						var elevationIndex = (polygon.elevation - (polygon.elevation % 13)) / 13;
						polygon.fill = colors[Math.min(elevationIndex, colors.length - 1)];
						Polygons.buffer(polygon);
					}
				});
			}
			else {
				// TODO: Implement elevation without coastlines
				// Probably best to do this as a preprocess, so that
				// it's not too different from the coastline case
			}
		}
	};
});
