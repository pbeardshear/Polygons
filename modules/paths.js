/*
 *
 *	Path object used for collecting corner objects for rendering
 *
 */

// Polygons.Paths
define(function () {
	// Internal class representing a path
	function path (corners) {
		this.corners = corners;
		// Default values, these should be set to change how the path is drawn
		this.stroke = '#000';
		this.thickness = 1;
	}
	path.prototype = {
		first: function () {
			return this.corners[0];
		},
		
		last: function () {
			return this.corners[this.corners.length - 1];
		},
		
		append: function (corner) {
			this.corners.push(corner);
		},
		
		// Get a list of {x,y} coordinates that make up this path
		getPoints: function () {
			return this.corners.map(function (c) { return c.pos });
		}
	};
	
	return {
		// Create a new path
		create: function () {
			var corners = Array.prototype.slice.call(arguments, 0);
			return new path(corners);
		}
	};
});
