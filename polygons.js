/*
 *
 *	Implementation of Lloyd's Algorithm for generating
 *	Voronoi polygons.
 *
 *	Cluster heuristic is average Euclidean distance to centroid.
 *	
 *	Implementation of Fortune's Algorithm taken from Raymond Hill <http://www.raymondhill.net/blog/?p=9>
 *
 */
 
Polygons = (function () {
	// Namespace for utility functions
	var util = {
		getEdges: function (cell) {
			return cell.halfedges.map(function (he) { return { start: he.getStartpoint(), end: he.getEndpoint() } });
		}
	};
	
	// Bind some useful utility methods to the global namespace
	// The reason they are namespaced globally is so that they are available
	// to the map modules
	window.iter = function (container, scope, fn) {
		if (!fn) {
			// User didn't pass in a scope, so the callback is the second argument
			fn = scope;
			scope = container;
		}
		if (Array.isArray(container)) {
			// Array iteration
			for (var i = 0; i < container.length; i++) {
				fn.call(scope, i, container[i]);
			}
		}
		else {
			// Hash iteration
			for (var index in container) {
				if (container.hasOwnProperty(index)) {
					fn.call(scope, index, container[index]);
				}
			}
		}
	};
	
	return {
		// Takes an edge and sets its vertices with the corner objects
		// that represent them, if they exist
		_transformEdge: function (index, edge) {
			edge.start = this.corners[edge.start] || edge.start;
			edge.end = this.corners[edge.end] || edge.end;
		},
		
		generate: function (height, width, pointCount, iterations) {
			// Set base parameters
			this.MapHeight = height;
			this.MapWidth = width;
			
			var boundingBox = { xl: 0, xr: width, yt: 0, yb: height },
				voronoi = new Voronoi();
				
			// Generate a random set of points initially
			var points = [];
			for (var i = 0; i < pointCount; i++) {
				points.push({ x: (Math.floor(Math.random() * width)), y: (Math.floor(Math.random() * height)) });
			}
			
			// Iterate using Lloyd relaxation to get more uniform polygons
			for (var i = 0; i < iterations; i++) {
				var result = voronoi.compute(points, boundingBox);
				// We only need to recompute the centroids if we are going to iterate the polygons again
				if (i + 1 < iterations) {
					// Iterate over the list of cells, and compute the centroid for each one
					points = [];
					var cells = result.cells;
					for (var c = 0; c < cells.length; c++) {
						// The centroid is the euclidean average of the x and y coordinates that make up the polygon
						var edges = cells[c].halfedges,
							xTotal = yTotal = 0;
						for (var e = 0; e < edges.length; e++) {
							var vertex = edges[e].getStartpoint();
							xTotal += vertex.x;
							yTotal += vertex.y;
						}
						// Add the new centroid to the list of anchor points
						points.push({ x: xTotal / edges.length, y: yTotal / edges.length });
					}
				}
			}
			
			var cells = result.cells,
				edges = result.edges;
			// Generate the graph structure to represent the diagram more effectively
			// TODO: Put this in a WebWorker thread and allow binding callbacks to its completion
			// 		 We shouldn't have to delay drawing the graph for this data, but other modules may depend on it
			this.centers = [];
			this.corners = {};
			this.edges = [];
			// Cells are organized by voronoiId, which correspond to their site location
			for (var i = 0; i < edges.length; i++) {
				// Centers
				// ------------------------------
				var leftSite = edges[i].lSite,
					leftCellID = leftSite.voronoiId,
					rightSite = edges[i].rSite,
					rightCellID = rightSite && rightSite.voronoiId;
				// Initialize the center objects if they don't yet exist
				if (!this.centers[leftCellID]) {
					this.centers[leftCellID] = { pos: cells[leftCellID].site, id: leftCellID, neighbors: {}, border: (!rightSite), edges: util.getEdges(cells[leftCellID]) };
				}
				if (rightSite && !this.centers[rightCellID]) {
					this.centers[rightCellID] = { pos: cells[rightCellID].site, id: rightCellID, neighbors: {}, border: false, edges: util.getEdges(cells[rightCellID]) };
				}
				
				// Add the centers as neighbors
				if (rightSite) {
					this.centers[leftCellID].neighbors[rightCellID] = this.centers[rightCellID];
					this.centers[rightCellID].neighbors[leftCellID] = this.centers[leftCellID];
				}
				else {
					this.centers[leftCellID].border = true;
				}
				
				// Corners
				// -----------------------------
				var vertexA = edges[i].va.toString(),
					vertexB = edges[i].vb.toString();
				if (!this.corners[vertexA]) {
					this.corners[vertexA] = { id: vertexA, pos: edges[i].va, adjacent: [], polygons: {} };
				}
				if (!this.corners[vertexB]) {
					this.corners[vertexB] = { id: vertexB, pos: edges[i].vb, adjacent: [], polygons: {} };
				}
				
				this.corners[vertexA].adjacent.push(this.corners[vertexB]);
				this.corners[vertexB].adjacent.push(this.corners[vertexA]);
				// Add the polygons that are adjacent to this corner
				this.corners[vertexA].polygons[leftCellID] = this.centers[leftCellID];
				this.corners[vertexB].polygons[leftCellID] = this.centers[leftCellID];
				// Transform the current polygons edge points from simple vertices to the corners
				iter(this.centers[leftCellID].edges, this, this._transformEdge);
				if (rightSite) {
					this.corners[vertexA].polygons[rightCellID] = this.centers[rightCellID];
					this.corners[vertexB].polygons[rightCellID] = this.centers[rightCellID];
					iter(this.centers[rightCellID].edges, this, this._transformEdge);
				}

			}
			
			return result;
		},
		
		// Draws each polygon, based on its stroke and fill
		// If none are provided, then we default to white fill and black stroke
		draw: function (canvas) {
			if (this.centers) {
				this.context = canvas.getContext('2d');
				var polygons = this.centers;
				this.context.save();
				iter(polygons, this, function (i, cell) {
					this.context.strokeStyle = cell.stroke || '#000';
					this.context.fillStyle = cell.fill || '#FFF';
					this.context.beginPath();
					for (var i = 0; i < cell.edges.length; i++) {
						var edge = cell.edges[i];
						this.context.lineTo(edge.start.pos.x, edge.start.pos.y);
						this.context.lineTo(edge.end.pos.x, edge.end.pos.y);
					}
					this.context.closePath();
					this.context.stroke();
					this.context.fill();
				});
				this.context.restore();
			}
			else {
				// The polygons weren't generated yet
				throw new Error('No polygons have been generated.  Please call Polygons.generate() first.');
			}
		}
	};
})();
