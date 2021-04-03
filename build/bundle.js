
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.37.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/OldHomePage.svelte generated by Svelte v3.37.0 */

    const file = "src/OldHomePage.svelte";

    function create_fragment$1(ctx) {
    	let meta;
    	let script;
    	let script_src_value;
    	let link0;
    	let link1;
    	let t0;
    	let main;
    	let div0;
    	let h10;
    	let t2;
    	let h3;
    	let t4;
    	let ul0;
    	let li0;
    	let t6;
    	let li1;
    	let t8;
    	let li2;
    	let t9;
    	let a;
    	let t11;
    	let strong0;
    	let t13;
    	let section;
    	let div12;
    	let div4;
    	let article0;
    	let h11;
    	let t15;
    	let div3;
    	let div1;
    	let ul1;
    	let li3;
    	let t17;
    	let li4;
    	let t19;
    	let li5;
    	let t21;
    	let li6;
    	let t23;
    	let div2;
    	let ul2;
    	let li7;
    	let t25;
    	let li8;
    	let t27;
    	let li9;
    	let t29;
    	let li10;
    	let t31;
    	let div6;
    	let article1;
    	let h12;
    	let t33;
    	let div5;
    	let ul3;
    	let li11;
    	let strong1;
    	let t35;
    	let t36;
    	let li12;
    	let strong2;
    	let t38;
    	let t39;
    	let li13;
    	let strong3;
    	let t41;
    	let t42;
    	let li14;
    	let strong4;
    	let t44;
    	let t45;
    	let div8;
    	let article2;
    	let h13;
    	let t47;
    	let div7;
    	let ul4;
    	let li15;
    	let strong5;
    	let t49;
    	let t50;
    	let li16;
    	let strong6;
    	let t52;
    	let t53;
    	let li17;
    	let strong7;
    	let t55;
    	let t56;
    	let div11;
    	let article3;
    	let h14;
    	let t58;
    	let div10;
    	let div9;
    	let p;
    	let t60;
    	let ul5;
    	let li18;
    	let t62;
    	let li19;
    	let t64;
    	let li20;
    	let t66;
    	let li21;
    	let t68;
    	let li22;

    	const block = {
    		c: function create() {
    			meta = element("meta");
    			script = element("script");
    			link0 = element("link");
    			link1 = element("link");
    			t0 = space();
    			main = element("main");
    			div0 = element("div");
    			h10 = element("h1");
    			h10.textContent = "Welcome to Rene Home Building";
    			t2 = space();
    			h3 = element("h3");
    			h3.textContent = "Contact Info";
    			t4 = space();
    			ul0 = element("ul");
    			li0 = element("li");
    			li0.textContent = "Cell & Text Msg: (323) 866-9964";
    			t6 = space();
    			li1 = element("li");
    			li1.textContent = "Emergency Contact: (323) 866-9964";
    			t8 = space();
    			li2 = element("li");
    			t9 = text("Email: ");
    			a = element("a");
    			a.textContent = "ilovetobuild4u@gmail.com";
    			t11 = space();
    			strong0 = element("strong");
    			strong0.textContent = "I can build your home for you.";
    			t13 = space();
    			section = element("section");
    			div12 = element("div");
    			div4 = element("div");
    			article0 = element("article");
    			h11 = element("h1");
    			h11.textContent = "Career Highlights";
    			t15 = space();
    			div3 = element("div");
    			div1 = element("div");
    			ul1 = element("ul");
    			li3 = element("li");
    			li3.textContent = "Free Consultations and Walkthroughs for every job performed";
    			t17 = space();
    			li4 = element("li");
    			li4.textContent = "20 years of dedicated experience as a home builder";
    			t19 = space();
    			li5 = element("li");
    			li5.textContent = "20 years of loyal service remodeling homes";
    			t21 = space();
    			li6 = element("li");
    			li6.textContent = "20 years of knowledgeable experience repairing homes";
    			t23 = space();
    			div2 = element("div");
    			ul2 = element("ul");
    			li7 = element("li");
    			li7.textContent = "Up-To-Date Compliance on every job performed, as per Building Codes enforced by location";
    			t25 = space();
    			li8 = element("li");
    			li8.textContent = "Extensive knowledge of all incorporated city building codes in Los Angeles County";
    			t27 = space();
    			li9 = element("li");
    			li9.textContent = "Round-the-clock emergency service on every job performed";
    			t29 = space();
    			li10 = element("li");
    			li10.textContent = "Drafted blue prints for 9100 Wilshire Blvd, 5th Floor, Tower B, Beverly Hills, CA 90210";
    			t31 = space();
    			div6 = element("div");
    			article1 = element("article");
    			h12 = element("h1");
    			h12.textContent = "Residential Qualifications";
    			t33 = space();
    			div5 = element("div");
    			ul3 = element("ul");
    			li11 = element("li");
    			strong1 = element("strong");
    			strong1.textContent = "Plumbing:";
    			t35 = text(" repiping; sewer-main; copper; tankless water heater installations; water heater relocations; laundry room accommodations; entire home water filtration; water softener systems; storm drains installation; french drain installation; rainwater gathering systems; pex; gas lines; earthquake valves; anti-backflow valves; irrigation systems; dripper systems; irrigation sprinklers and zoned filtration stations");
    			t36 = space();
    			li12 = element("li");
    			strong2 = element("strong");
    			strong2.textContent = "Electrical:";
    			t38 = text(" electrical panel upgrades (LED title 24 compliant); rewiring; upgrade; troubleshooting; solar panel troubleshooting; single-phase and recessed lighting (LED title 24 compliant)");
    			t39 = space();
    			li13 = element("li");
    			strong3 = element("strong");
    			strong3.textContent = "Other:";
    			t41 = text(" outdoor decks; patio structures; cabanas--all material types; concrete; waterproofing; Masonry: driveways, foundation, slabs, walkways, state of the art, monolithic BBQ installations & patios; Framing: structural, architectural & metal; Kitchen Remodeling: caesarstone, granite, quartz, marble & butcher boards; Remodeling: Bathroom, Home & Home additions; Drywall: all textures; cathedral ceiling accomodations & all types of finishes");
    			t42 = space();
    			li14 = element("li");
    			strong4 = element("strong");
    			strong4.textContent = "More:";
    			t44 = text(" retro-fitting: earthquake & structural; tile: mosaic, glass, all materials; music studios: wiring & sound proofing; painting; stucco; window & door installations (tempered and stained glass); skylights; storage rooms; blue prints; insulation; gutter installations; property fencing & gates; hillside property soil retention; demolition; haul-offs; job clean-ups; tree trimming; A/C mini split systems; wall heater installation; motorized gates");
    			t45 = space();
    			div8 = element("div");
    			article2 = element("article");
    			h13 = element("h1");
    			h13.textContent = "Commercial Qualifications";
    			t47 = space();
    			div7 = element("div");
    			ul4 = element("ul");
    			li15 = element("li");
    			strong5 = element("strong");
    			strong5.textContent = "Plumbing:";
    			t49 = text(" plumbing relocation; water efficiency calculations; tankless water heater installations; french drain installation; rainwater gathering systems; zoned filtration stations (i.e. cappuccino machines); instant hot installations; water filtration systems; gas line installations & earthquake valve installations");
    			t50 = space();
    			li16 = element("li");
    			strong6 = element("strong");
    			strong6.textContent = "Electrical:";
    			t52 = text(" electrical load calculations; fluorescent lighting; three-phase and recessed lighting (LED title 24 compliant)");
    			t53 = space();
    			li17 = element("li");
    			strong7 = element("strong");
    			strong7.textContent = "Other:";
    			t55 = text(" floor plan modifications; flooring--all material types; glass block installation; bathroom & kitchen accomodations; interior walls; blueprinting; wall heater installation/relocation; A/C mini split systems; metal framing; fire door installation; fire caulking; motorized gates; drywall texturing--all types; framing; structural; architectural & metal; painting; stucco; music studio wiring & sound proofing");
    			t56 = space();
    			div11 = element("div");
    			article3 = element("article");
    			h14 = element("h1");
    			h14.textContent = "References Available Upon Request";
    			t58 = space();
    			div10 = element("div");
    			div9 = element("div");
    			p = element("p");
    			p.textContent = "Hobbies & Interests";
    			t60 = space();
    			ul5 = element("ul");
    			li18 = element("li");
    			li18.textContent = "Helping people";
    			t62 = space();
    			li19 = element("li");
    			li19.textContent = "Hiking";
    			t64 = space();
    			li20 = element("li");
    			li20.textContent = "Dancing";
    			t66 = space();
    			li21 = element("li");
    			li21.textContent = "Basketball";
    			t68 = space();
    			li22 = element("li");
    			li22.textContent = "Singing";
    			attr_dev(meta, "charset", "utf-8");
    			add_location(meta, file, 1, 2, 16);
    			document.title = "Rene Home Building";
    			script.async = true;
    			if (script.src !== (script_src_value = "https://www.googletagmanager.com/gtag/js?id=UA-116904419-1")) attr_dev(script, "src", script_src_value);
    			add_location(script, file, 3, 2, 77);
    			attr_dev(link0, "rel", "stylesheet");
    			attr_dev(link0, "href", "https://unpkg.com/tachyons@4.7.0/css/tachyons.min.css");
    			add_location(link0, file, 4, 2, 168);
    			attr_dev(link1, "rel", "stylesheet");
    			attr_dev(link1, "href", "http://unpkg.com/tachyons-flexbox@2.0.5/css/tachyons-flexbox.min.css");
    			add_location(link1, file, 5, 2, 256);
    			add_location(h10, file, 18, 4, 682);
    			add_location(h3, file, 19, 4, 725);
    			add_location(li0, file, 21, 6, 779);
    			add_location(li1, file, 22, 6, 826);
    			attr_dev(a, "href", "mailto:ilovetobuild4u@gmail.com");
    			add_location(a, file, 23, 17, 886);
    			add_location(li2, file, 23, 6, 875);
    			attr_dev(ul0, "class", "list pa2");
    			add_location(ul0, file, 20, 4, 751);
    			add_location(strong0, file, 25, 4, 976);
    			attr_dev(div0, "class", "center tc lh-copy");
    			add_location(div0, file, 17, 2, 646);
    			attr_dev(h11, "class", "f4 bg-near-white br3 br--top black-60 bb b--black-10 mv0 pv2 ph3");
    			add_location(h11, file, 33, 10, 1303);
    			add_location(li3, file, 37, 16, 1610);
    			add_location(li4, file, 38, 16, 1695);
    			add_location(li5, file, 39, 16, 1771);
    			add_location(li6, file, 40, 16, 1839);
    			attr_dev(ul1, "class", "f6 f5-ns lh-copy measure");
    			add_location(ul1, file, 36, 14, 1556);
    			attr_dev(div1, "class", "meta-card center flex flex-column w-100 w-100-m w-50-l");
    			add_location(div1, file, 35, 12, 1473);
    			add_location(li7, file, 45, 16, 2089);
    			add_location(li8, file, 46, 16, 2203);
    			add_location(li9, file, 47, 16, 2310);
    			add_location(li10, file, 48, 16, 2392);
    			attr_dev(ul2, "class", "f6 f5-ns lh-copy measure");
    			add_location(ul2, file, 44, 14, 2035);
    			attr_dev(div2, "class", "meta-card center flex flex-column w-100 w-100-m w-50-l");
    			add_location(div2, file, 43, 12, 1952);
    			attr_dev(div3, "class", "pa3 flex flex-wrap bg-washed-blue");
    			add_location(div3, file, 34, 10, 1413);
    			attr_dev(article0, "class", "center br3 hidden ba b--black-10 mv4 w-100 flex flex-column justify-between");
    			add_location(article0, file, 32, 8, 1199);
    			attr_dev(div4, "class", "meta-card center flex flex-wrap pa3 w-75");
    			add_location(div4, file, 31, 6, 1136);
    			attr_dev(h12, "class", "f4 bg-near-white br3 br--top black-60 bb b--black-10 mv0 pv2 ph3");
    			add_location(h12, file, 57, 10, 2765);
    			add_location(strong1, file, 60, 18, 2970);
    			add_location(li11, file, 60, 14, 2966);
    			add_location(strong2, file, 61, 18, 3425);
    			add_location(li12, file, 61, 14, 3421);
    			add_location(strong3, file, 62, 18, 3654);
    			add_location(li13, file, 62, 14, 3650);
    			add_location(strong4, file, 63, 18, 4137);
    			add_location(li14, file, 63, 14, 4133);
    			attr_dev(ul3, "class", "f6 f5-ns lh-copy measure");
    			add_location(ul3, file, 59, 12, 2914);
    			attr_dev(div5, "class", "pa3");
    			add_location(div5, file, 58, 10, 2884);
    			attr_dev(article1, "class", "bg-washed-blue center br3 hidden ba b--black-10 mv4 w-100 flex flex-column");
    			add_location(article1, file, 56, 8, 2662);
    			attr_dev(div6, "class", "meta-card center flex flex-wrap pa3 w-100 w-75-m w-50-l");
    			add_location(div6, file, 55, 6, 2584);
    			attr_dev(h13, "class", "f4 bg-near-white br3 br--top black-60 bb b--black-10 mv0 pv2 ph3");
    			add_location(h13, file, 71, 10, 4864);
    			add_location(strong5, file, 74, 18, 5068);
    			add_location(li15, file, 74, 14, 5064);
    			add_location(strong6, file, 75, 18, 5426);
    			add_location(li16, file, 75, 14, 5422);
    			add_location(strong7, file, 76, 18, 5589);
    			add_location(li17, file, 76, 14, 5585);
    			attr_dev(ul4, "class", "f6 f5-ns lh-copy measure");
    			add_location(ul4, file, 73, 12, 5012);
    			attr_dev(div7, "class", "pa3");
    			add_location(div7, file, 72, 10, 4982);
    			attr_dev(article2, "class", "bg-washed-blue center br3 hidden ba b--black-10 mv4 w-100 flex flex-column");
    			add_location(article2, file, 70, 8, 4761);
    			attr_dev(div8, "class", "meta-card center flex flex-wrap pa3 w-100 w-75-m w-50-l");
    			add_location(div8, file, 69, 6, 4683);
    			attr_dev(h14, "class", "f4 bg-near-white br3 br--top black-60 bb b--black-10 mv0 pv2 ph3");
    			add_location(h14, file, 84, 10, 6266);
    			add_location(p, file, 87, 14, 6535);
    			add_location(li18, file, 89, 16, 6630);
    			add_location(li19, file, 90, 16, 6670);
    			add_location(li20, file, 91, 16, 6702);
    			add_location(li21, file, 92, 16, 6735);
    			add_location(li22, file, 93, 16, 6771);
    			attr_dev(ul5, "class", "f6 f5-ns lh-copy measure");
    			add_location(ul5, file, 88, 14, 6576);
    			attr_dev(div9, "class", "meta-card center flex flex-column w-100 w-100-m w-50-l");
    			add_location(div9, file, 86, 12, 6452);
    			attr_dev(div10, "class", "pa3 flex flex-wrap bg-washed-blue");
    			add_location(div10, file, 85, 10, 6392);
    			attr_dev(article3, "class", "center br3 hidden ba b--black-10 mv4 w-100 flex flex-column justify-between");
    			add_location(article3, file, 83, 8, 6162);
    			attr_dev(div11, "class", "meta-card center flex flex-wrap pa3 w-75");
    			add_location(div11, file, 82, 6, 6099);
    			attr_dev(div12, "class", "cf ph2-ns content-width flex flex-wrap");
    			add_location(div12, file, 29, 4, 1076);
    			attr_dev(section, "class", "mw9 center ph3-ns");
    			add_location(section, file, 28, 2, 1036);
    			attr_dev(main, "class", "near-black bg-lightest-blue");
    			add_location(main, file, 16, 0, 601);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document.head, meta);
    			append_dev(document.head, script);
    			append_dev(document.head, link0);
    			append_dev(document.head, link1);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, div0);
    			append_dev(div0, h10);
    			append_dev(div0, t2);
    			append_dev(div0, h3);
    			append_dev(div0, t4);
    			append_dev(div0, ul0);
    			append_dev(ul0, li0);
    			append_dev(ul0, t6);
    			append_dev(ul0, li1);
    			append_dev(ul0, t8);
    			append_dev(ul0, li2);
    			append_dev(li2, t9);
    			append_dev(li2, a);
    			append_dev(div0, t11);
    			append_dev(div0, strong0);
    			append_dev(main, t13);
    			append_dev(main, section);
    			append_dev(section, div12);
    			append_dev(div12, div4);
    			append_dev(div4, article0);
    			append_dev(article0, h11);
    			append_dev(article0, t15);
    			append_dev(article0, div3);
    			append_dev(div3, div1);
    			append_dev(div1, ul1);
    			append_dev(ul1, li3);
    			append_dev(ul1, t17);
    			append_dev(ul1, li4);
    			append_dev(ul1, t19);
    			append_dev(ul1, li5);
    			append_dev(ul1, t21);
    			append_dev(ul1, li6);
    			append_dev(div3, t23);
    			append_dev(div3, div2);
    			append_dev(div2, ul2);
    			append_dev(ul2, li7);
    			append_dev(ul2, t25);
    			append_dev(ul2, li8);
    			append_dev(ul2, t27);
    			append_dev(ul2, li9);
    			append_dev(ul2, t29);
    			append_dev(ul2, li10);
    			append_dev(div12, t31);
    			append_dev(div12, div6);
    			append_dev(div6, article1);
    			append_dev(article1, h12);
    			append_dev(article1, t33);
    			append_dev(article1, div5);
    			append_dev(div5, ul3);
    			append_dev(ul3, li11);
    			append_dev(li11, strong1);
    			append_dev(li11, t35);
    			append_dev(ul3, t36);
    			append_dev(ul3, li12);
    			append_dev(li12, strong2);
    			append_dev(li12, t38);
    			append_dev(ul3, t39);
    			append_dev(ul3, li13);
    			append_dev(li13, strong3);
    			append_dev(li13, t41);
    			append_dev(ul3, t42);
    			append_dev(ul3, li14);
    			append_dev(li14, strong4);
    			append_dev(li14, t44);
    			append_dev(div12, t45);
    			append_dev(div12, div8);
    			append_dev(div8, article2);
    			append_dev(article2, h13);
    			append_dev(article2, t47);
    			append_dev(article2, div7);
    			append_dev(div7, ul4);
    			append_dev(ul4, li15);
    			append_dev(li15, strong5);
    			append_dev(li15, t49);
    			append_dev(ul4, t50);
    			append_dev(ul4, li16);
    			append_dev(li16, strong6);
    			append_dev(li16, t52);
    			append_dev(ul4, t53);
    			append_dev(ul4, li17);
    			append_dev(li17, strong7);
    			append_dev(li17, t55);
    			append_dev(div12, t56);
    			append_dev(div12, div11);
    			append_dev(div11, article3);
    			append_dev(article3, h14);
    			append_dev(article3, t58);
    			append_dev(article3, div10);
    			append_dev(div10, div9);
    			append_dev(div9, p);
    			append_dev(div9, t60);
    			append_dev(div9, ul5);
    			append_dev(ul5, li18);
    			append_dev(ul5, t62);
    			append_dev(ul5, li19);
    			append_dev(ul5, t64);
    			append_dev(ul5, li20);
    			append_dev(ul5, t66);
    			append_dev(ul5, li21);
    			append_dev(ul5, t68);
    			append_dev(ul5, li22);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			detach_dev(meta);
    			detach_dev(script);
    			detach_dev(link0);
    			detach_dev(link1);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(main);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function gtag() {
    	dataLayer.push(arguments);
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("OldHomePage", slots, []);
    	window.dataLayer = window.dataLayer || [];
    	gtag("js", new Date());
    	gtag("config", "UA-116904419-1");
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<OldHomePage> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ gtag });
    	return [];
    }

    class OldHomePage extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "OldHomePage",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.37.0 */

    function create_fragment(ctx) {
    	let oldhomepage;
    	let current;
    	oldhomepage = new OldHomePage({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(oldhomepage.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(oldhomepage, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(oldhomepage.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(oldhomepage.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(oldhomepage, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ OldHomePage });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body,
        props: {
            name: 'world'
        }
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
