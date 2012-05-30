/*
 *
 *	Map module for adding rivers based on elevation
 *
 *	Rivers always flow downhill to the ocean
 *
 */
 
define(['modules/oceans', 'modules/elevation'], function () {
	var RiverStroke = '#0000FF';

	return {
		// @private
		// Returns the neighboring corner with the lowest elevation
		_lowestNeighbor: function (corner) {
			return corner.adjacent.reduce(function (a, b) { return b.elevation < a.elevation ? b : a });
		},
		
		generate: function (count) {
			// Pick count number of corners on the map as starting points for the rivers
			var centers = Polygons.centers,
				next;
			for (var i = 0; i < count; i++) {
				var polygon = centers[Math.floor(Math.random() * centers.length)];
				while (polygon.ocean) {
					polygon = centers[Math.floor(Math.random() * centers.length)];
				}
				// Always choose the first edge's starting corner
				// This gives up very little generality, as edge positions are not absolutely ordered
				current = polygon.edges[0].start;
				// Follow the downslope until we reach the ocean
				while (current.land) {
					next = this._lowestNeighbor(current);
					var edge = Polygons.getEdge(current, next);
					edge.stroke = RiverStroke;
					edge.thickness = 5;
					current = next;
				}
			}
			
		}
	};
});
