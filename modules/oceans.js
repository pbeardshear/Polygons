/*
 *
 *	Map module for adding oceans and islands.
 *	
 *	All modules add themselves to the Polygons namespace.
 *
 */
 
Polygons.Oceans = (function () {
	var colors = [
		'#FF0000',
		'#FF7600',
		'#FFDB00',
		'#34D800',
		'#04859D',
		'#2818B1',
		'#6F0AAA',
		'#C7007D'
	];
	
	var util = {
		// Returns the distance to the closest border edge
		getBorderDistance: function (polygon) {
			return Math.min(
				Math.min(polygon.pos.x, Polygons.MapWidth - polygon.pos.x),  // x distance
				Math.min(polygon.pos.y, Polygons.MapHeight - polygon.pos.y)	 // y distance
			);
		},
		// Returns a random number between [-0.5, 0.5)
		rand: function () {
			return Math.random() - 0.5;
		}
	};
	
	return {
		// fill [bool] => ocean will completely surround the map
		// depth [int] => how far inland the ocean should penetrate
		generate: function (fill, noise, threshold, stepSize) {
			var context = Polygons.context,
				threshold = threshold || Polygons.MapWidth / 6,
				stepSize = stepSize || 20;
			// Categorize a tile as ocean, based on whether it meets a threshold criteria based on
			// its distance away from the border of the map
			// Random noise is also introduced to give a more natural look
			iter(Polygons.centers, function (i, polygon) {
				var distance = util.getBorderDistance(polygon);
				if ((fill && polygon.border) || (distance + (util.rand()*noise*stepSize)) < threshold) {
					polygon.ocean = true;
					polygon.fill = '#1921B1';
					polygon.stroke = '#000';
				}
			});
			
			// Coastlines
			var hasOcean, hasLand;
			iter(Polygons.corners, function (i, corner) {
				hasOcean = hasLand = false;
				iter(corner.polygons, function (j, polygon) {
					if (polygon.ocean) {
						hasOcean = true;
					}
					else {
						hasLand = true;
					}
				});
				corner.coast = hasOcean && hasLand;
				corner.ocean = hasOcean && (!hasLand);
				corner.land = (!hasOcean) && hasLand;
			});
			// TODO: Post Processing to even out lone single islands
		}
	};
})();
