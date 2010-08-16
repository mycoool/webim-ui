/* webim UI:
*
* options:
* attributes:
* 	im
* 	layout
*
* methods:
*
* events:
*
*/

function webimUI(element, options){
	var self = this;
	self.element = element;
	self.options = extend({}, webimUI.defaults, options);
	self._init();
}
extend(webimUI.prototype, objectExtend, {
	render:function(){
		var self = this, layout = self.layout;
		self.element.appendChild(layout.element);
		setTimeout(function(){self.initSound()}, 1000);
		layout.buildUI();
	},
	_init: function(){
		var self = this,
		im = self.im = new webim(),
		layout = self.layout = new webimUI.layout(null,{
			chatAutoPop: im.setting.get("msg_auto_pop")
		}),
		options = self.options;
		im.setting.get("play_sound") ? sound.enable() : sound.disable() ;
		im.setting.get("minimize_layout") ? layout.collapse() : layout.expand(); 
		self._initEvents();
	},
	addApp: function(name, options){
		var e = webimUI.apps[name];
		if(!e)return;
		var self = this, im = self.im;
		isFunction(e.init) && e.init.apply(self, [options]);
		isFunction(e.ready) && im.bind("ready", function(){e.ready.apply(self, arguments);});
		isFunction(e.go) && im.bind("go", function(){e.go.apply(self, arguments);});
		isFunction(e.stop) && im.bind("stop", function(){e.stop.apply(self, arguments);});
	},
	initSound: function(urls){
		sound.init(urls || this.options.soundUrls);
	},
	_initEvents: function(){
		var self = this, im = self.im, buddy = im.buddy, history = im.history, status = im.status, setting = im.setting, buddyUI = self.buddy, layout = self.layout, room = im.room;
		//im events
		im.bind("ready",function(){
			layout.changeState("ready");
			//show(layout.widget("room").window.element);
		}).bind("go",function(data){
			layout.changeState("active");
			layout.option("user", data.user);
			date.init(data.server_time);
			self._initStatus();
			//setting.set(data.setting);
		}).bind("stop", function(type){
			layout.changeState("stop");
			//hide(layout.widget("room").window.element);
			type == "offline" && layout.removeAllChat();
			layout.updateAllChat();
		});
		//setting events
		setting.bind("update",function(key, val){
			switch(key){
				case "play_sound": (val ? sound.enable() : sound.disable() ); 
				break;
				case "msg_auto_pop": layout.option("chatAutoPop", val); 
				break;
				case "minimize_layout": 
				(val ? layout.collapse() : layout.expand()); 
				break;
			}
		});

		buddy.bind("online", function(data){
			layout.updateChat("buddy", data);
		}).bind("offline", function(data){
			layout.updateChat("buddy", data);
		}).bind("update", function(data){
			layout.updateChat("buddy", data);
		});

		layout.bind("collapse", function(){
			setting.set("minimize_layout", true);
		});
		layout.bind("expand", function(){
			setting.set("minimize_layout", false);
		});

		//display status
		layout.bind("displayUpdate", function(e){
			self._updateStatus(); //save status
		});

		//all ready.
		//message
		im.bind("message", function(data){
			var show = false,roomData = this.room.dataHash,
			l = data.length, d, uid = im.data.user.id, id, c, count = "+1";
			for(var i = 0; i < l; i++){
				d = data[i];
				id = d["id"], type = d["type"];
				c = layout.chat(type, id);
				c && c.status("");//clear status
				if(!c){	
					var titlename = (d.type === "unicast")?d.nick:roomData[id].nick;
					if (d.type === "unicast"){
						self.addChat(type, id, null, null, titlename);
					}else{
						self.addChat(type, id);  
					}
					c = layout.chat(type, id);
				}
				c && setting.get("msg_auto_pop") && !layout.activeTabId && layout.focusChat(id);
				c.window.notifyUser("information", count);
				var p = c.window.pos;
				(p == -1) && layout.setNextMsgNum(count);
				(p == 1) && layout.setPrevMsgNum(count);
				if(d.from != uid)show = true;
			}
			if(show){
				sound.play('msg');
				titleShow(i18n("new message"), 5);
			}
		});

		im.bind("status",function(data){
			each(data,function(n,msg){
				var userId = im.data.user.id;
				var id = msg['from'];
				if (userId != msg.to && userId != msg.from) {
					id = msg.to; //群消息
					var nick = msg.nick;
				}else{
					var c = layout.chat("buddy", id);
					c && c.status(msg['show']);
				}
			});
		});
		//for test
		history.bind("unicast", function( id, data){
			var c = layout.chat("unicast", id), count = "+" + data.length;
			if(c){
				c.history.add(data);
			}
			//(c ? c.history.add(data) : im.addChat(id));
		});
		history.bind("multicast", function(id, data){
			var c = layout.chat("multicast", id), count = "+" + data.length;
			if(c){
				c.history.add(data);
			}
			//(c ? c.history.add(data) : im.addChat(id));
		});
		history.bind("clear", function(type, id){
			var c = layout.chat(type, id);
			c && c.history.clear();
		});


	},
	__status: false,
	_initStatus: function(){
		var self = this, layout = self.layout;
		if(self.__status)return layout.updateAllChat();
		// status start
		self.__status = true;
		var status = self.im.status,
		tabs = status.get("tabs"), 
		tabIds = status.get("tabIds"),
		//prev num
		p = status.get("p"), 
		//focus tab
		a = status.get("a");

		tabIds && tabIds.length && tabs && each(tabs, function(k,v){
			var id = k.slice(2), type = k[0];
			self.addChat(type, id, {}, { isMinimize: true});
			layout.chat(k).window.notifyUser("information", v["n"]);
		});
		p && (layout.prevCount = p) && layout._fitUI();
		a && layout.focusChat(a);
		// status end
	},
	addChat: function(type, id, options, winOptions, nick){
		type = _tr_type(type);
		var self = this, layout = self.layout, im = self.im, history = self.im.history, buddy = im.buddy, room = im.room;
		if(layout.chat(type, id))return;
		if(type == "room"){
			var h = history.multicast(id), info = room.get(id), _info = info || {id:id, nick: nick || id};
			_info.presence = "online";
			layout.addChat(type, _info, extend({history: h, block: true, emot:true, clearHistory: false, member: true, msgType: "multicast"}, options), winOptions);
			if(!h) history.load("multicast", id);
			var chat = layout.chat(type, id);
			chat.bind("sendMsg", function(msg){
				im.sendMsg(msg);
				history.handle(msg);
			}).bind("select", function(info){
				buddy.online(info.id);//online
				self.addChat("buddy", info.id, null, null, info.nick);
				layout.focusChat("buddy", info.id);
			}).bind("block", function(d){
				room.block(d.id);
			}).bind("unblock", function(d){
				room.unblock(d.id);
			}).window.bind("close",function(){
				chat.options.info.blocked && room.leave(id);
			});
			setTimeout(function(){
				if(chat.options.info.blocked)room.join(id);
				else room.initMember(id);
			}, 500);
			isArray(_info.members) && each(_info.members, function(n, info){
				chat.addMember(info.id, info.nick, info.id == im.data.user.id);
			});

		}else{
			var h = history.unicast(id), info = buddy.get(id);
			var _info = info || {id:id, nick: nick || id};
			layout.addChat(type, _info, extend({history: h, block: false, emot:true, clearHistory: true, member: false, msgType: "unicast"}, options), winOptions);
			if(!info) buddy.update(id);
			if(!h) history.load("unicast", id);
			layout.chat(type, id).bind("sendMsg", function(msg){
				im.sendMsg(msg);
				history.handle(msg);
			}).bind("sendStatus", function(msg){
				im.sendStatus(msg);
			}).bind("clearHistory", function(info){
				history.clear("unicast", info.id);
			});
		}
	},
	_updateStatus: function(){
		var self = this, layout = self.layout, _tabs = {}, panels = layout.panels;
		each(layout.tabs, function(n, v){
			_tabs[n] = {
				n: v._count()//,
				//t: panels[n].options.type //type: buddy,room
			};
		});
		var d = {
			//o:0, //has offline
			tabs: _tabs, // n -> notice count
			tabIds: layout.tabIds,
			p: layout.prevCount, //tab prevCount
			//b: layout.widget("buddy").window.isMinimize() ? 0 : 1, //is buddy open
			a: layout.activeTabId //tab activeTabId
		}
		self.im.status.set(d);
	}
});

var _countDisplay = function(element, count){
	if (count === undefined){
		return parseInt(element.innerHTML);
	}
	else if (count){
		count = (typeof count == "number") ? count : (parseInt(element.innerHTML) + parseInt(count));
		element.innerHTML = count.toString();
		show(element);
	}
	else {
		element.innerHTML = '0';
		hide(element);
	}
	return count;
};

function mapElements(obj){
	var elements = obj.getElementsByTagName("*"), el, id, need = {}, pre = ":", preLen = pre.length;
	for(var i = elements.length - 1; i > -1; i--){
		el = elements[i];
		id = el.id;
		if(id && id.indexOf(pre) == 0)need[id.substring(preLen, id.length)] = el;
	}
	return need;
}
function createElement(str){
	var el = document.createElement("div");
	el.innerHTML = str;
	el = el.firstChild; // release memory in IE ???
	return el;
}
var tpl = (function(){
	var dic = null, re = /\<\%\=(.*?)\%\>/ig;
	function call(a, b){
		return dic && dic[b] !=undefined ? dic[b] : i18n(b);
	}
	return function(str, hash){
		if(!str)return '';
		dic = hash;
		return str.replace(re, call);
	};
})();



var plugin = {
	add: function(module, option, set) {
		var proto = webimUI[module].prototype;
		for(var i in set){
			proto.plugins[i] = proto.plugins[i] || [];
			proto.plugins[i].push([option, set[i]]);
		}
	},
	call: function(instance, name, args) {
		var set = instance.plugins[name];
		if(!set || !instance.element.parentNode) { return; }

		for (var i = 0; i < set.length; i++) {
			if (instance.options[set[i][0]]) {
				set[i][1].apply(instance.element, args);
			}
		}
	}
};

/*
* widget
* options:
* 	template
* 	className
*
* attributes:
* 	id
* 	name
* 	className
* 	element
* 	$
*
* methods:
* 	template
*
*/
var _widgetId = 1;
function widget(name, defaults, prototype){
	function m(element, options){
		var self = this;
		self.id = _widgetId++;
		self.name = name;
		self.className = "webim-" + name;
		self.options = extend({}, m['defaults'], options);

		//template
		self.element = element || (self.template && createElement(self.template())) || ( self.options.template && createElement(tpl(self.options.template)));
		if(self.element){
			self.options.className && addClass(self.element, self.options.className);
			self.$ = mapElements(self.element);
		}
		isFunction(self._init) && self._init();
		//isFunction(self._initEvents) && setTimeout(function(){self._initEvents()}, 0);
		isFunction(self._initEvents) && self._initEvents();
	}
	m.defaults = defaults;// default options;
	// add prototype
	extend(m.prototype, objectExtend, widget.prototype, prototype);
	webimUI[name] = m;
}

extend(widget.prototype, {
	_init: function(){
	}
});
function _tr_type(type){
	return type == "b" || type == "buddy" || type == "unicast" ? "buddy" : "room";
}
function app(name, events){
	webimUI.apps[name] = events || {};
}
extend(webimUI,{
	version: "@VERSION",
	widget: widget,
	app: app,
	plugin: plugin,
	i18n: i18n,
	date: date,
	ready: ready,
	createElement: createElement,
	defaults: {},
	apps:{}
});
webim.ui = webimUI;

