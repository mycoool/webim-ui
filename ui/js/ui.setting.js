//
/* ui.config:
 *
 options:
 attributes：

 methods:
 check_tag

 destroy()
 events: 
 change

 */
webim.widget("config",{
        _init: function(){
                var self = this, element = self.element, options = self.options;
                if(!element){
                        element = self.element = $(tpl(options.template)).addClass(self.widgetClassName);
                }
                self.ul = element.children("ul:first");
                self.tags = {};
                //self._initEvents();
        },
        check_tag: function(name, isChecked){
                var self = this, tags = self.tags, tag = tags[name];
                if(tag){
                        tag.children("input")[0].checked = isChecked;
                        return;
                }
                var temp = $(tpl(self.options.template_c,{
                        label: i18n(name),
                        id: "webim-setting-" + name,
                        name: name,
                        checked: isChecked ? 'checked="checked"' : ''
                }));
                temp.children("input").click(function(e){
                        self._change(this.name, this.checked);
                });
                temp.appendTo(self.ul);
                tags[name] = temp;
        },
        _change:function(name, value){
                this.trigger("change", [name, value]);
        },
        destroy: function(){
        }
});
webim.ui.config.defaults = {
        event:'click',
        template: '<div id="webim-config">\
                        <ul></ul>\
                  </div>',
        template_c: '<li><input type="checkbox" <%=checked%> id="<%=id%>" name="<%=name%>"/><label for="<%=id%>"><%=label%></label></li>'
};
