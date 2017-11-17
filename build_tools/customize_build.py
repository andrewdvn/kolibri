import os
import tempfile

import requests
from kolibri.utils import conf

os.environ.setdefault(
    "BUILD_TIME_PLUGINS", os.path.join(os.path.dirname(__file__), "default_plugins.txt")
)

os.environ.setdefault(
    "RUN_TIME_PLUGINS", os.path.join(os.path.dirname(__file__), "default_plugins.txt")
)

"""
Other environment variables:

DEFAULT_SETTINGS_MODULE, which should be a Python module path to a settings file that will
be used by default at load time.

UNBUILT_PLUGINS, which should be a txt file git repo urls for unbuilt plugins.
These plugins will be built and added to the requirements for the built file.
"""

plugins_cache = {}

def load_plugins_from_file(file_path):
    global plugins_cache
    if file_path not in plugins_cache:
        # We have been passed a URL, not a local file path
        if file_path.startswith('http'):
            _, path = tempfile.mkstemp(suffix=".txt", text=True)
            with open(path, 'w') as f:
                r = requests.get(file_path)
                f.write(r.content)
            file_path = path
        with open(file_path, 'r') as f:
            plugins_cache[file_path] = [plugin.strip() for plugin in f.readlines() if f]
    return plugins_cache[file_path]


build_config_path = os.path.join(os.path.dirname(__file__), "../kolibri/utils/build_config")

default_settings_template = "settings_path = '{path}'"

def set_default_settings_module():
    if "DEFAULT_SETTINGS_MODULE" in os.environ:
        default_settings_path = os.environ["DEFAULT_SETTINGS_MODULE"]
        with open(os.path.join(build_config_path, "default_settings.py"), 'w') as f:
            # Just write out settings_path = '<settings_path>'
            f.write(run_time_plugin_template.format(path=default_settings_path))


def set_build_time_plugins():
    if "BUILD_TIME_PLUGINS" in os.environ:
        build_plugins = load_plugins_from_file(os.environ["BUILD_TIME_PLUGINS"])
        # For now, we still need to enable these plugins in order to build them
        # When the build system has been decoupled, this list of plugins can be used for that instead

        # First disable all plugins, and then enable the plugins listed
        conf.config['INSTALLED_APPS'] = build_plugins
        conf.save()


run_time_plugin_template = "plugins = {plugins}\n"

def set_run_time_plugins():
    if "RUN_TIME_PLUGINS" in os.environ:
        runtime_plugins = load_plugins_from_file(os.environ["RUN_TIME_PLUGINS"])
        with open(os.path.join(build_config_path, "default_plugins.py"), 'w') as f:
            # Just write out 'plugins = [...]' <-- list of plugins
            f.write(run_time_plugin_template.format(plugins=runtime_plugins.__str__()))


if __name__ == "__main__":
    set_build_time_plugins()
    set_default_settings_module()
    set_run_time_plugins()