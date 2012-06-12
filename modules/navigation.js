/*
 *
 *	Creates a navigation bar for use with the example app.
 *	Useful for testing various modules and tweaking parameters.
 *
 */

define(function () {
	var modules,
		groups;
	
	return {
		init: function (cfg) {
			// Get a reference to all of the modules that we have loaded
			modules = Polygons.loadedModules;
			groups = cfg.groups;
			
			// Create a section for each group
			for (var header in groups) {
				if (groups.hasOwnProperty(header)) {
					var html = generateHeader(header),
						items = groups[header];
					for (var i = 0; i < items.length; i++) {
						
					}
				}
			}
		}
	};
}); 
 
