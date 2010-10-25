var rtm = {
	serviceURL: "http://api.rememberthemilk.com/services/rest/",
	authURL: "http://www.rememberthemilk.com/services/auth/",
	cache: {
		defaultFilter: "status:incomplete",
		currentFilter: defaultFilter,
		tasks: {
			_list: [],
			get: function() {
				return _list;
			},
			clear: function() {
				list.length = 0;
			},
			comparator: function(p,q) {
				return 0;
			},
			add: function(response) {
				if (response.tasks == undefined) return -1;
				if (response.tasks.list == undefined) return 0;
				
				var lists = response.tasks.list;
				$.each (lists, function(index, list) {
					var tasks = list.taskseries;
					$.each (tasks, function (taskIndex, task) {
						task.list = list.id;
						_list.push (task);
					}
				}
				
				_list.sort (comparator);	
			}, // end of add()
		}, // end of object tasks
	}, // end of object cache
	
	/**
	 * signRequest 
	 * Adds the "api_sig" parameter to authenticate a request, using the
	 * application's shared secret. Requires the 'auth' object, containing
	 * the api_key and shared_secret to be present.
	 * see http://www.rememberthemilk.com/services/api/authentication.rtm
	 * @param the data to be signed, in an associative array
	 * e.g., {"method":"rtm.test.login", "api_key":"foo"}
	 * @return the same array, with an "api_sig" parameter added.
	 */
	signRequest: function (params) {
		delete params["api_sig"]; // remove the signature if already present.
		// add other frequent paramters, just in case
		params["api_key"] = auth.api_key;
		params["format"] = "json";
		if (auth.token != undefined) params["auth_token"] = auth.token;
		
		// sort the keys in alphabetical order
		var keys = [];
		$.each (params, function (key) {
			keys.push (key);
		});
		keys.sort();
		
		var str = auth.shared_secret;
		$.each (keys, function (index, key) {
			str += (key + params[key]);
		});
		
		params["api_sig"] = hex_md5(str);
		return params;
	}, // end signRequest
	
	
	getFrob: function () {
		var params = rtm.signRequest ({"method": "rtm.auth.getFrob"});
		$.getJSON (rtm.serviceURL, params, function (data) {
			var response = data.rsp;
			if (rtm.isCorrectResponse(response)) {
				auth.frob = response.frob;
			}
			else rtm.handleErrorResponse (response);
		});
	},
	
	getAuthenticationURL: function () {
		var params = rtm.signRequest ({"perms":"delete", "frob":auth.frob});
	},
	
	getToken: function () {
		var params = rtm.signRequest ({"frob":auth.frob, "method":"rtm.auth.getToken"});
		$.getJSON (rtm.serviceURL, params, function (data) {
			var response = data.rsp;
			if (rtm.isCorrectResponse(response)) {
				// deep copy all elements in the response into the auth object.
				$.extend (true, auth, response.auth);
			}
			else rtm.handleErrorResponse (response);
		});
	}, // end of getToken
	
	checkToken: function () {
		if (auth.token == undefined) {
			rtm.getToken();
			return;
		}
		
		var params = rtm.signRequest ({"method":"rtm.auth.checkToken"});
		$.getJSON (rtm.serviceURL, params, function (data) {
			var response = data.rsp;
			if (rtm.isCorrectResponse(response)) {
				// deep copy all elements in the response into the auth object.
				$.extend (true, auth, response.auth);
			}
			else rtm.handleErrorResponse (response);
		});
	}, // end of checkToken
	
	createTimeline: function () {
		var params = rtm.signRequest ({"method":"rtm.timelines.create"});
		$.getJSON (rtm.serviceURL, params, function (data) {
			var response = data.rsp;
			if (rtm.isCorrectResponse(response)) {
				auth["timeline"] = response.timeline;
			}
			else rtm.handleErrorResponse (response);
		});
	},
	
	getTasks: function (filter) {
		if (filter == undefined) filter = cache.defaultFilter;
		var params = {"method":"rtm.tasks.getList", "filter":filter};
		if (filter != cache.currentFilter) {
			cache.lastSyncedAt = undefined;
		} else {
			params["last_sync"] = cache.lastSyncedAt;
		}
		
		$.getJSON (rtm.serviceURL, rtm.signRequest(params), function(data) {
			var response = data.rsp;
			if (rtm.isCorrectResponse(response)) {
				cache.currentFilter = filter;
				if (cache.lastSyncedAt == undefined) cache.tasks.clear();
				cache.lastSyncedAt = null; // current time
				cache.tasks.add (response);
			}
			else rtm.handleErrorResponse (response);
		});
	}, // end getTasks
	
	isCorrectResponse: function (response) {
		return (response.stat == "ok");
	}, // end isValidResponse
	
	handleErrorResponse: function (response) {
		alert (response.err.code + ": "+response.err.msg);
	} // end handleErrorResponse

} // end rtm